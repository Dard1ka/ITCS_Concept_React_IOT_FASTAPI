import os
import time
import threading

import cv2
import numpy as np
import pandas as pd
import serial
from serial import SerialException

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from ultralytics import YOLO
try:
    from ultralytics import RTDETR
    HAS_RTDETR = True
except ImportError:
    RTDETR = None
    HAS_RTDETR = False

import torch
from PIL import Image
from torchvision import transforms as T
from torchvision.models.detection import fcos_resnet50_fpn


# ===================== MODEL CONFIG =====================
# (BLYNK DI-SKIP: realtime sekarang pakai "state engine" di server + Pico via serial)
ENABLE_BLYNK = False  # jangan dihapus, biar jelas mode sekarang tanpa blynk
BLYNK_TOKEN = os.getenv("BLYNK_TOKEN", "Cm7dn4jDsq-p8g6F9opd47AbJX6d4RMX")

YOLO_MODEL_PATH   = "yolov11n_visdrone_5cls_bikemoto_ft.pt"
FCOS_MODEL_PATH   = "fcos.pth"
RTDETR_MODEL_PATH = "rtdetr_visdrone_5cls.pt"

CONF_THRESH = 0.35
IMGSZ = 640

YOLO_CONF_THRESH = 0.15
YOLO_IMGSZ = 1280

RTDETR_CONF_THRESH = 0.15
RTDETR_IMGSZ = 512

LAST_RT = {
    "line": None,
    "ts": 0.0,
}

LAST_RT_LINE = None
LAST_RT_TS = 0.0

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

VEHICLE_CLASSES = {"bicycle", "car", "truck", "bus", "motorcycle"}
PCU = {
    "motorcycle": 0.5,
    "car": 1.0,
    "bicycle": 0.4,
    "kendaraan_besar": 2.0,
}

MIN_GREEN_FUZZY = 15
MAX_GREEN_FUZZY = 45

CLASSES_FCOS_RT = ["bicycle", "car", "truck", "bus", "motorcycle"]
to_tensor = T.ToTensor()

OUT_DIR = os.path.join("static", "output")
os.makedirs(OUT_DIR, exist_ok=True)


# ===================== SERIAL CONFIG (PC -> PICO via COM9) =====================
SERIAL_PORT = os.getenv("SIGMA_SERIAL_PORT", "COM9")
SERIAL_BAUD = int(os.getenv("SIGMA_SERIAL_BAUD", "115200"))

# ===================== SERIAL HELPERS =====================
_serial_lock = threading.Lock()
_serial_instance = None

def _get_serial():
    global _serial_instance
    try:
        if _serial_instance is None or not _serial_instance.is_open:
            _serial_instance = serial.Serial(
                SERIAL_PORT,
                SERIAL_BAUD,
                timeout=1
            )
            time.sleep(2.0)  # Pico warmup
        return _serial_instance
    except Exception as e:
        print("[SERIAL] OPEN ERROR:", e)
        return None

LAST_RT_LINE = None
LAST_RT_TS = 0.0
LAST_SCHED = None
LAST_SCHED_TS = 0.0

def serial_reader_loop():
    global LAST_RT_LINE, LAST_RT_TS, LAST_SCHED, LAST_SCHED_TS
    while True:
        line = ""
        with _serial_lock:
            ser = _get_serial()
            if ser is None:
                pass
            else:
                try:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                except Exception:
                    line = ""

        if not line:
            time.sleep(0.05)
            continue

        if line.startswith("RT,"):
            LAST_RT_LINE = line
            LAST_RT_TS = time.time()
        elif line.startswith("SCHED,"):
            # format: SCHED,gU,rU,gT,rT,gS,rS,gB,rB
            LAST_SCHED = line
            LAST_SCHED_TS = time.time()

threading.Thread(target=serial_reader_loop, daemon=True).start()


def send_durations_to_pico(green_dir: dict, red_dir: dict):
    """
    (Tetap dibiarkan) helper lama.
    """
    try:
        gU = int(round(green_dir["UTARA"]))
        rU = int(round(red_dir["UTARA"]))
        gT = int(round(green_dir["TIMUR"]))
        rT = int(round(red_dir["TIMUR"]))
        gS = int(round(green_dir["SELATAN"]))
        rS = int(round(red_dir["SELATAN"]))
        gB = int(round(green_dir["BARAT"]))
        rB = int(round(red_dir["BARAT"]))

        payload = f"{gU},{rU},{gT},{rT},{gS},{rS},{gB},{rB}\n"

        ser = serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
        time.sleep(2.0)  # WAJIB (biar Pico siap)
        ser.write(payload.encode("utf-8"))
        ser.close()

        print("[SERIAL] SENT:", payload.strip())
        return True

    except Exception as e:
        print("[SERIAL] ERROR:", e)
        return False


def send_durations_to_pico_from_df(df_fuzzy: pd.DataFrame) -> bool:
    """
    Kirim 1 baris ke Pico:
      gU,rU,gT,rT,gS,rS,gB,rB\\n
    """
    def g(a: str) -> int:
        try:
            return int(round(float(df_fuzzy.loc[a, "Green_time"])))
        except Exception:
            return 10

    def r(a: str) -> int:
        try:
            return int(round(float(df_fuzzy.loc[a, "Red_time"])))
        except Exception:
            return 50

    gU, rU = g("UTARA"),   r("UTARA")
    gT, rT = g("TIMUR"),   r("TIMUR")
    gS, rS = g("SELATAN"), r("SELATAN")
    gB, rB = g("BARAT"),   r("BARAT")

    line = f"{gU},{rU},{gT},{rT},{gS},{rS},{gB},{rB}\n"
    data = line.encode("utf-8")

    with _serial_lock:
        ser = _get_serial()
        if ser is None:
            print("[SERIAL] Not sent (port not available).")
            return False
        try:
            ser.write(data)
            ser.flush()
            print(f"[SERIAL] Sent -> {SERIAL_PORT}: {line.strip()}")
            return True
        except SerialException as e:
            print(f"[SERIAL] Write error: {e}")
            try:
                ser.close()
            except Exception:
                pass
            return False


# ===================== FASTAPI SETUP =====================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",       # ✅ tambah ini
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",       # ✅ tambah ini juga (optional tapi aman)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")


# ===================== LOAD MODELS =====================
print("Loading YOLO model...")
yolo_model = YOLO(YOLO_MODEL_PATH)
print("YOLO Loaded.")

print("Loading FCOS model...")
def load_fcos_model(model_path: str):
    num_classes = len(CLASSES_FCOS_RT) + 1  # + background
    model = fcos_resnet50_fpn(
        weights=None,
        weights_backbone=None,
        num_classes=num_classes,
        min_size=IMGSZ,
        max_size=IMGSZ,
    )
    state = torch.load(model_path, map_location=DEVICE)
    if isinstance(state, dict):
        for k in ["model", "model_state", "state_dict"]:
            if k in state:
                state = state[k]
                break
    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    return model

fcos_model = load_fcos_model(FCOS_MODEL_PATH)
print("FCOS Loaded.")

if HAS_RTDETR:
    try:
        print("Loading RT-DETR model...")
        rtdetr_model = RTDETR(RTDETR_MODEL_PATH)
        print("RT-DETR Loaded.")
    except Exception as e:
        print(f"RT-DETR failed to load: {e}")
        rtdetr_model = None
else:
    rtdetr_model = None
    print("RT-DETR class not available in ultralytics. Skipping RT-DETR.")


# ===================== STATE =====================
LAST_FUZZY = {
    "UTARA":   {"Green_time": 10.0, "Red_time": 50.0},
    "TIMUR":   {"Green_time": 10.0, "Red_time": 50.0},
    "SELATAN": {"Green_time": 10.0, "Red_time": 50.0},
    "BARAT":   {"Green_time": 10.0, "Red_time": 50.0},
}

# ===================== REALTIME "PICO-STYLE" STATE ENGINE =====================
# Tujuan: ganti realtime blynk -> server kasih realtime countdown (mirror cycle Pico)
URUTAN_ARAH = ["UTARA", "TIMUR", "SELATAN", "BARAT"]
YELLOW_TIME = 1.5
ALL_RED_TIME = 1.0
DEFAULT_CYCLE_1 = {
    "UTARA":   {"Green_time": 10.0, "Red_time": 42.0},
    "TIMUR":   {"Green_time": 10.0, "Red_time": 42.0},
    "SELATAN": {"Green_time": 10.0, "Red_time": 42.0},
    "BARAT":   {"Green_time": 10.0, "Red_time": 42.0},
}


_state_lock = threading.Lock()
_current_sched = {
    a: {"Green_time": float(LAST_FUZZY[a]["Green_time"]), "Red_time": float(LAST_FUZZY[a]["Red_time"])}
    for a in URUTAN_ARAH
}
_pending_sched = None  # dipakai setelah 1 siklus selesai (mirip Pico apply_pending_update)
_cycle_t0 = time.time()
_current_state = {
    "active_arah": "UTARA",
    "phase": "all_red",  # all_red | yellow | green
    "remaining": 0,
    "rt_green": {"UTARA": 0, "TIMUR": 0, "SELATAN": 0, "BARAT": 0},
    "rt_red": {"UTARA": 0, "TIMUR": 0, "SELATAN": 0, "BARAT": 0},
    "using_pending": False,
}

def _build_timeline(schedule: dict):
    """
    Bangun list segmen fase persis seperti di Pico:
      all_red (1) -> yellow (Y) -> green (Gdir) -> all_red (1) untuk tiap arah.
    Return: list of (arah, phase, duration_seconds)
    """
    tl = []
    for arah in URUTAN_ARAH:
        g = float(schedule.get(arah, {}).get("Green_time", 10.0))
        tl.append((arah, "all_red", ALL_RED_TIME))
        tl.append((arah, "yellow", YELLOW_TIME))
        tl.append((arah, "green", g))
        tl.append((arah, "all_red", ALL_RED_TIME))
    return tl

def _cycle_len(schedule: dict) -> float:
    return sum(d for _, _, d in _build_timeline(schedule))

def _compute_red_remaining(schedule: dict, active_arah: str, phase: str, remaining: float) -> dict:
    """
    Mirip fungsi Pico compute_red_remaining(): waktu sampai arah tsb dapat hijau lagi.
    - Kalau phase != green, maka "remaining" = sisa durasi phase sekarang (yellow/all_red).
    - Kalau phase == green, remaining = sisa hijau arah aktif.
    """
    # kita hitung dengan mensimulasikan timeline dari posisi sekarang sampai tiap arah masuk yellow->green
    tl = _build_timeline(schedule)

    # cari posisi "sekarang" di timeline: segmen pertama yg match (arah, phase)
    # catatan: all_red muncul dua kali per arah, tapi itu memang; di sini cukup pakai traversal aktual.
    # Untuk akurat, kita bangun traversal berjalan dari awal dan cari state berdasarkan t-cycle,
    # tapi karena kita sudah ada (phase,active,remaining), kita hitung "time to next green" via forward-walk.
    out = {a: 0 for a in URUTAN_ARAH}
    if phase == "green":
        out[active_arah] = 0

    # fungsi helper: waktu sampai target arah masuk phase "green" segmen miliknya
    def time_to_green(target: str) -> int:
        t = float(remaining)
        # berjalan ke depan sesuai urutan setelah segmen sekarang selesai
        # model posisi saat ini: (active_arah, phase) sedang berjalan
        found_current = False
        for arah, ph, dur in tl:
            if not found_current:
                if arah == active_arah and ph == phase:
                    found_current = True
                continue
        if not found_current:
            # fallback
            return int(round(t))

        # lanjut traversal dari segmen setelah current sampai ketemu (target,"green")
        passed_current = False
        for arah, ph, dur in tl:
            if not passed_current:
                if arah == active_arah and ph == phase:
                    passed_current = True
                continue
            if arah == target and ph == "green":
                return int(round(t))
            t += float(dur)

        # kalau tidak ketemu (harusnya ketemu), berarti wrap ke awal siklus berikutnya
        for arah, ph, dur in tl:
            if arah == target and ph == "green":
                return int(round(t))
            t += float(dur)

        return int(round(t))

    for a in URUTAN_ARAH:
        if a == active_arah and phase == "green":
            out[a] = 0
        else:
            out[a] = time_to_green(a)
    return out

def _engine_loop():
    global _cycle_t0, _current_state, _current_sched, _pending_sched
    while True:
        with _state_lock:
            sched = _current_sched
            tl = _build_timeline(sched)
            total = sum(d for _, _, d in tl)

            # apply pending hanya saat "siklus penuh" sudah lewat
            now = time.time()
            t = (now - _cycle_t0)
            if total > 0 and t >= total:
                # wrap ke siklus baru
                _cycle_t0 = now
                t = 0.0
                if _pending_sched is not None:
                    _current_sched = _pending_sched
                    _pending_sched = None
                    sched = _current_sched
                    tl = _build_timeline(sched)
                    total = sum(d for _, _, d in tl)

            # cari segmen aktif
            acc = 0.0
            active_arah = URUTAN_ARAH[0]
            phase = "all_red"
            seg_dur = 0.0
            seg_start = 0.0
            for arah, ph, dur in tl:
                if acc + dur > t:
                    active_arah = arah
                    phase = ph
                    seg_dur = dur
                    seg_start = acc
                    break
                acc += dur

            remaining = max(0.0, (seg_start + seg_dur) - t)
            remaining_i = int(round(remaining))

            # rt_green: hanya saat phase == green, arah aktif punya countdown
            rt_green = {a: 0 for a in URUTAN_ARAH}
            if phase == "green":
                rt_green[active_arah] = remaining_i

            rt_red = _compute_red_remaining(sched, active_arah, phase, remaining)

            _current_state = {
                "active_arah": active_arah,
                "phase": phase,
                "remaining": remaining_i,
                "rt_green": rt_green,
                "rt_red": rt_red,
                "using_pending": (_pending_sched is not None),
            }

        time.sleep(0.2)

_thread_engine = threading.Thread(target=_engine_loop, daemon=True)
_thread_engine.start()


# ===================== HELPERS =====================
def kategori_kendaraan(label: str):
    if label in ("truck", "bus"):
        return "kendaraan_besar"
    if label == "motorcycle":
        return "motorcycle"
    if label == "bicycle":
        return "bicycle"
    if label == "car":
        return "car"
    return None

def draw_overlay(frame, dets, agg_counts, agg_pcu):
    img = frame.copy()

    for d in dets:
        x1, y1, x2, y2 = d["box_xyxy"]
        label = d["label"]

        cv2.rectangle(img, (x1, y1), (x2, y2), (10, 255, 20), 2)
        cv2.putText(
            img,
            label,
            (x1, max(0, y1 - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (10, 255, 20),
            2,
        )

    y0 = 30
    lines = [
        f"TOTAL PCU: {agg_pcu:.1f}",
        f"car: {agg_counts['car']}",
        f"motorcycle: {agg_counts['motorcycle']}",
        f"bicycle: {agg_counts['bicycle']}",
        f"kendaraan_besar: {agg_counts['kendaraan_besar']}",
    ]
    for i, line in enumerate(lines):
        cv2.putText(
            img,
            line,
            (10, y0 + i * 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2,
        )

    return img

def detect_yolo(bgr):
    results = yolo_model(
        bgr,
        imgsz=YOLO_IMGSZ,
        conf=YOLO_CONF_THRESH,
        iou=0.6,
        max_det=500,
        verbose=False,
    )

    r = results[0]
    dets = []
    agg_counts = {"kendaraan_besar": 0, "car": 0, "motorcycle": 0, "bicycle": 0}
    agg_pcu = 0.0

    if r is not None and r.boxes is not None and len(r.boxes) > 0:
        names = yolo_model.names
        for b in r.boxes:
            cls_name = names[int(b.cls.item())]
            if cls_name not in VEHICLE_CLASSES:
                continue

            kat = kategori_kendaraan(cls_name)
            if kat is None:
                continue

            agg_counts[kat] += 1
            agg_pcu += PCU.get(kat, 0.0)

            x1, y1, x2, y2 = map(int, b.xyxy.cpu().numpy().ravel())
            dets.append({"label": kat, "box_xyxy": [x1, y1, x2, y2]})

    return dets, agg_counts, agg_pcu

def detect_fcos(bgr):
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    img_tensor = to_tensor(pil_img).to(DEVICE)

    with torch.no_grad():
        outputs = fcos_model([img_tensor])[0]

    boxes = outputs["boxes"].cpu().numpy()
    labels = outputs["labels"].cpu().numpy()
    scores = outputs["scores"].cpu().numpy()

    dets = []
    agg_counts = {"kendaraan_besar": 0, "car": 0, "motorcycle": 0, "bicycle": 0}
    agg_pcu = 0.0

    for box, lbl, score in zip(boxes, labels, scores):
        if score < CONF_THRESH:
            continue

        cls_id = int(lbl)
        if cls_id <= 0 or cls_id > len(CLASSES_FCOS_RT):
            continue

        cls_name = CLASSES_FCOS_RT[cls_id - 1]
        if cls_name not in VEHICLE_CLASSES:
            continue

        kat = kategori_kendaraan(cls_name)
        if kat is None:
            continue

        x1, y1, x2, y2 = map(int, box)
        agg_counts[kat] += 1
        agg_pcu += PCU.get(kat, 0.0)
        dets.append({"label": kat, "box_xyxy": [x1, y1, x2, y2]})

    return dets, agg_counts, agg_pcu

def detect_rtdetr(bgr):
    if rtdetr_model is None:
        agg_counts = {"kendaraan_besar": 0, "car": 0, "motorcycle": 0, "bicycle": 0}
        return [], agg_counts, 0.0

    results = rtdetr_model(
        bgr,
        imgsz=RTDETR_IMGSZ,
        conf=RTDETR_CONF_THRESH,
        iou=0.6,
        max_det=500,
        verbose=False,
    )

    r = results[0]
    dets = []
    agg_counts = {"kendaraan_besar": 0, "car": 0, "motorcycle": 0, "bicycle": 0}
    agg_pcu = 0.0

    if r is not None and r.boxes is not None and len(r.boxes) > 0:
        names = rtdetr_model.names
        for b in r.boxes:
            cls_id = int(b.cls.item())
            cls_name = names[cls_id]
            if cls_name not in VEHICLE_CLASSES:
                continue

            kat = kategori_kendaraan(cls_name)
            if kat is None:
                continue

            x1, y1, x2, y2 = map(int, b.xyxy.cpu().numpy().ravel())
            agg_counts[kat] += 1
            agg_pcu += PCU.get(kat, 0.0)
            dets.append({"label": kat, "box_xyxy": [x1, y1, x2, y2]})

    return dets, agg_counts, agg_pcu

def process_image_bytes(img_bytes, model_type: str, save_overlay: bool = True, out_name: str = "OUT"):
    arr = np.asarray(bytearray(img_bytes), dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        return None

    model_type = (model_type or "yolo").lower()
    if model_type == "fcos":
        dets, counts, pcu = detect_fcos(bgr)
    elif model_type == "rtdetr":
        dets, counts, pcu = detect_rtdetr(bgr)
    else:
        dets, counts, pcu = detect_yolo(bgr)

    overlay_url = None
    if save_overlay:
        overlay = draw_overlay(bgr, dets, counts, pcu)
        out_path = os.path.join(OUT_DIR, f"{out_name}.jpg")
        cv2.imwrite(out_path, overlay)
        overlay_url = f"/static/output/{out_name}.jpg"

    return {
        "pcu_total": round(float(pcu), 2),
        "counts": {
            "car": int(counts["car"]),
            "motorcycle": int(counts["motorcycle"]),
            "bicycle": int(counts["bicycle"]),
            "kendaraan_besar": int(counts["kendaraan_besar"]),
        },
        "overlay_url": overlay_url,
    }


# ===================== FUZZY =====================
def fuzzy_low(x):
    if x <= 0:
        return 1.0
    if 0 < x <= 15:
        return 1 - (x / 15.0)
    if 15 < x <= 25:
        return max(0.0, (25 - x) / 10.0)
    return 0.0

def fuzzy_med(x):
    if 10 < x <= 20:
        return (x - 10) / 10.0
    if 20 < x <= 30:
        return (30 - x) / 10.0
    return 0.0

def fuzzy_high(x):
    if x <= 20:
        return 0.0
    if 20 < x <= 30:
        return (x - 20) / 10.0
    return 1.0

def compute_fuzzy(df):
    BASE = 10.0
    EXTRA = 40.0
    G_MIN = MIN_GREEN_FUZZY
    G_MAX = MAX_GREEN_FUZZY

    weights = {}
    for idx, row in df.iterrows():
        p = row["PCU_total"]
        w = 0.5 * fuzzy_low(p) + 1.0 * fuzzy_med(p) + 1.5 * fuzzy_high(p)
        weights[idx] = max(w, 0.1)

    SW = sum(weights.values()) if len(weights) else 1.0
    green = {}
    for idx in df.index:
        share = weights[idx] / SW
        g = BASE + share * EXTRA
        g = max(G_MIN, min(G_MAX, g))
        green[idx] = g

    rows = []
    for idx in df.index:
        g = green[idx]
        r = sum(green[j] for j in green if j != idx)
        rows.append(
            {
                "Persimpangan": idx,
                "PCU_total": float(df.loc[idx]["PCU_total"]),
                "Green_time": round(g, 2),
                "Red_time": round(r, 2),
            }
        )

    return pd.DataFrame(rows).set_index("Persimpangan")


# ===================== ROUTES =====================
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/realtime_pico")
def api_realtime_pico():

    def parse_sched(line: str):
        # SCHED,gU,rU,gT,rT,gS,rS,gB,rB
        parts = (line or "").split(",")
        if len(parts) != 9:
            return None
        try:
            _, gU, rU, gT, rT, gS, rS, gB, rB = parts
            return {
                "UTARA":   {"Green_time": float(gU), "Red_time": float(rU)},
                "TIMUR":   {"Green_time": float(gT), "Red_time": float(rT)},
                "SELATAN": {"Green_time": float(gS), "Red_time": float(rS)},
                "BARAT":   {"Green_time": float(gB), "Red_time": float(rB)},
            }
        except Exception:
            return None

    pico_sched = parse_sched(LAST_SCHED)

    # ===== CASE 1: RT BELUM ADA (CYCLE PERTAMA) =====
    if not LAST_RT_LINE:
        return {
            "active_arah": "",
            "phase": "",
            "remaining": 0,
            "rt_green": {"UTARA": 0, "TIMUR": 0, "SELATAN": 0, "BARAT": 0},
            "rt_red": {"UTARA": 0, "TIMUR": 0, "SELATAN": 0, "BARAT": 0},

            # ✅ DEFAULT CYCLE 1
            "schedule": pico_sched if pico_sched else DEFAULT_CYCLE_1,

            "age_ms": None,
            "delay_ms": None,
        }

    # ===== CASE 2: RT SUDAH ADA =====
    parts = LAST_RT_LINE.split(",")
    try:
        _, active, remaining, gU, gT, gS, gB, rU, rT, rS, rB = parts

        return {
            "active_arah": active,
            "phase": "GREEN",
            "remaining": int(float(remaining)),

            "rt_green": {
                "UTARA": int(float(gU)),
                "TIMUR": int(float(gT)),
                "SELATAN": int(float(gS)),
                "BARAT": int(float(gB)),
            },
            "rt_red": {
                "UTARA": int(float(rU)),
                "TIMUR": int(float(rT)),
                "SELATAN": int(float(rS)),
                "BARAT": int(float(rB)),
            },

            # 🔴 DAN DI SINI JUGA
            # ✅ DEFAULT CYCLE 1
            "schedule": pico_sched if pico_sched else DEFAULT_CYCLE_1,

            "age_ms": int((time.time() - LAST_RT_TS) * 1000),
            "delay_ms": int((time.time() - LAST_RT_TS) * 1000),
        }

    except Exception:
        return {"error": "bad_rt_format", "raw": LAST_RT_LINE}




# (Endpoint lama blynk tetap ada, tapi dimatikan biar tidak mengganggu)
@app.get("/api/realtime_blynk")
async def api_realtime_blynk():
    raise HTTPException(status_code=410, detail="Blynk realtime dimatikan. Pakai /api/realtime_pico")


@app.post("/api/process")
async def api_process(
    model_type: str = Form("yolo"),
    utara: UploadFile = File(...),
    timur: UploadFile = File(...),
    selatan: UploadFile = File(...),
    barat: UploadFile = File(...),
):
    global LAST_FUZZY, _pending_sched

    try:
        intersections = {
            "UTARA": utara,
            "TIMUR": timur,
            "SELATAN": selatan,
            "BARAT": barat,
        }

        results = {}
        rows = []

        for name, file in intersections.items():
            img_bytes = await file.read()
            out = process_image_bytes(img_bytes, model_type=model_type, save_overlay=True, out_name=name)
            if out is None:
                results[name] = {"error": "invalid_image"}
                continue

            results[name] = out
            rows.append({
                "Persimpangan": name,
                "PCU_total": out["pcu_total"],
                "car": out["counts"]["car"],
                "motorcycle": out["counts"]["motorcycle"],
                "bicycle": out["counts"]["bicycle"],
                "kendaraan_besar": out["counts"]["kendaraan_besar"],
            })

        if len(rows) > 0:
            df_pcu = pd.DataFrame(rows).set_index("Persimpangan")
            df_fuzzy = compute_fuzzy(df_pcu)

            new_last = {}
            for arah in ["UTARA", "TIMUR", "SELATAN", "BARAT"]:
                if arah in df_fuzzy.index:
                    new_last[arah] = {
                        "Green_time": float(df_fuzzy.loc[arah, "Green_time"]),
                        "Red_time": float(df_fuzzy.loc[arah, "Red_time"]),
                    }
                else:
                    new_last[arah] = LAST_FUZZY.get(arah, {"Green_time": 10.0, "Red_time": 50.0})

            LAST_FUZZY = new_last

            # kirim ke Pico (tetap)
            serial_ok = send_durations_to_pico_from_df(df_fuzzy)

            # update realtime engine: jangan langsung otak-atik cycle berjalan,
            # kita simpan pending dan apply pas siklus selesai (mirip Pico).
            with _state_lock:
                _pending_sched = {
                    a: {"Green_time": float(LAST_FUZZY[a]["Green_time"]), "Red_time": float(LAST_FUZZY[a]["Red_time"])}
                    for a in URUTAN_ARAH
                }

            return {
                "model_type": model_type,
                "results": results,
                "pcu_table": df_pcu.to_dict(orient="index"),
                "fuzzy_table": df_fuzzy.to_dict(orient="index"),
                "serial_sent": serial_ok,
                "serial_port": SERIAL_PORT,
                "serial_baud": SERIAL_BAUD,
            }

        return {
            "model_type": model_type,
            "results": results,
            "pcu_table": {},
            "fuzzy_table": {},
            "serial_sent": False,
            "serial_port": SERIAL_PORT,
            "serial_baud": SERIAL_BAUD,
        }

    except Exception as e:
        print("[/api/process ERROR]", repr(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/", response_class=HTMLResponse)
def ui(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "result": None},
    )

@app.post("/process", response_class=HTMLResponse)
async def process(
    request: Request,
    model_type: str = Form("yolo"),
    utara: UploadFile = File(...),
    timur: UploadFile = File(...),
    selatan: UploadFile = File(...),
    barat: UploadFile = File(...),
):
    """
    UI testing (bukan untuk React).
    """
    intersections = {"UTARA": utara, "TIMUR": timur, "SELATAN": selatan, "BARAT": barat}

    output_paths = {}
    rows = []

    for name, file in intersections.items():
        img_bytes = await file.read()
        out = process_image_bytes(img_bytes, model_type=model_type, save_overlay=True, out_name=name)
        if out is None:
            continue

        output_paths[name] = out["overlay_url"]
        rows.append({
            "Persimpangan": name,
            "PCU_total": out["pcu_total"],
            "car": out["counts"]["car"],
            "motorcycle": out["counts"]["motorcycle"],
            "bicycle": out["counts"]["bicycle"],
            "kendaraan_besar": out["counts"]["kendaraan_besar"],
        })

    df_pcu = pd.DataFrame(rows).set_index("Persimpangan") if len(rows) else pd.DataFrame()
    df_fuzzy = compute_fuzzy(df_pcu) if len(rows) else pd.DataFrame()

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "result": {
                "images": output_paths,
                "pcu_table": df_pcu.to_dict(orient="index") if len(rows) else {},
                "fuzzy_table": df_fuzzy.to_dict(orient="index") if len(rows) else {},
                "model_type": model_type,
            },
        },
    )

@app.get("/pico_state", response_class=PlainTextResponse)
def pico_state():
    """
    Endpoint lama kamu (tetap).
    """
    global LAST_FUZZY

    def g(a):
        return float(LAST_FUZZY.get(a, {}).get("Green_time", 10.0))

    def r(a):
        return float(LAST_FUZZY.get(a, {}).get("Red_time", 50.0))

    gU = g("UTARA");   rU = r("UTARA")
    gT = g("TIMUR");   rT = r("TIMUR")
    gS = g("SELATAN"); rS = r("SELATAN")
    gB = g("BARAT");   rB = r("BARAT")

    payload = f"{gU:.2f},{rU:.2f},{gT:.2f},{rT:.2f},{gS:.2f},{rS:.2f},{gB:.2f},{rB:.2f}"
    return payload

@app.get("/api/serial_status")
def api_serial_status():
    with _serial_lock:
        try:
            ser = _get_serial()
            if ser is None:
                return {"ready": False, "port": SERIAL_PORT, "baud": SERIAL_BAUD, "detail": "cannot_open"}
            # optional: cek is_open
            if not getattr(ser, "is_open", False):
                return {"ready": False, "port": SERIAL_PORT, "baud": SERIAL_BAUD, "detail": "not_open"}
            return {"ready": True, "port": SERIAL_PORT, "baud": SERIAL_BAUD, "detail": "ok"}
        except Exception as e:
            return {"ready": False, "port": SERIAL_PORT, "baud": SERIAL_BAUD, "detail": str(e)}