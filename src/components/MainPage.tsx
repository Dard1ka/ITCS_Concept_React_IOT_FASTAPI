// ✅ PERUBAHAN MINIMAL: tambah TAB (Detection / Monitor Pico)
// - Navbar tidak diubah
// - Pindah tab tidak reset (panel mounted, pakai display none/block)
// - Polling realtime jalan hanya saat tab Monitor Pico dibuka
// - Tab button dipaling atas & dibuat lebar (full width)
// - Header (badge + judul + deskripsi) dipindah ke bawah tab bar,
//   dan hanya muncul sesuai tab yang aktif

import React, { useEffect, useMemo, useState } from "react";
import { FaRepeat } from "react-icons/fa6";
import {
  Box,
  Badge,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Container,
  FormControl,
  FormLabel,
  Select,
  Input,
  Button,
  Spinner,
  Image,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
  Divider,
  useColorModeValue,
  useColorMode,
  useMediaQuery,
} from "@chakra-ui/react";

type ModelType = "yolo" | "fcos" | "rtdetr";
type ActiveTab = "detect" | "realtime";

type Counts = {
  car: number;
  motorcycle: number;
  bicycle: number;
  kendaraan_besar: number;
};

type PerImageResult = {
  pcu_total?: number;
  counts?: Counts;
  overlay_url?: string | null;
  error?: string;
};

type ApiResponse = {
  model_type: string;
  results: Record<string, PerImageResult>;
  pcu_table: Record<
    string,
    {
      PCU_total: number;
      car: number;
      motorcycle: number;
      bicycle: number;
      kendaraan_besar: number;
    }
  >;
  fuzzy_table: Record<
    string,
    {
      PCU_total: number;
      Green_time: number;
      Red_time: number;
    }
  >;

  // optional fields
  serial_sent?: boolean;
  serial_port?: string;
  serial_baud?: number;
};

const DIRS = ["UTARA", "TIMUR", "SELATAN", "BARAT"] as const;

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;

// ✅ realtime pico response
type RtPicoResponse = {
  active_arah: string;
  phase: string;
  remaining: number;
  rt_green: Record<string, number>;
  rt_red: Record<string, number>;
  schedule?: Record<string, { Green_time: number; Red_time: number }>;
  delay_ms?: number;
  age_ms?: number;
};

export default function MainPage() {
  const toast = useToast();
  const { colorMode } = useColorMode();
  const [isNarrow] = useMediaQuery("(max-width: 628px)");

  // ✅ TAB STATE
  const [activeTab, setActiveTab] = useState<ActiveTab>("detect");

  const [modelType, setModelType] = useState<ModelType>("yolo");
  const [files, setFiles] = useState<Record<(typeof DIRS)[number], File | null>>({
    UTARA: null,
    TIMUR: null,
    SELATAN: null,
    BARAT: null,
  });

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ApiResponse | null>(null);

  const [serialReady, setSerialReady] = useState<boolean | null>(null);
  const [serialDetail, setSerialDetail] = useState<string>("");

  // Serial status UI state
  const [serialStatus, setSerialStatus] = useState<{ ok: boolean | null; message: string }>({
    ok: null,
    message: "",
  });

  const titleBadgeDetect = useMemo(() => `Smart Traffic • ${modelType.toUpperCase()} + Fuzzy`, [modelType]);
  const titleBadgeRealtime = useMemo(() => `Smart Traffic • Pico + Realtime`, []);

  const onPickFile = (dir: (typeof DIRS)[number], f: File | null) => {
    setFiles((prev) => ({ ...prev, [dir]: f }));
  };

  const canSubmit = useMemo(() => DIRS.every((d) => files[d] instanceof File), [files]);
  const prettyFileName = (f: File | null) => (f ? f.name : "Pilih file");

  const [overlayNonce, setOverlayNonce] = useState(0);

  // ====== Real-time ======
  const [rtData, setRtData] = useState<Array<{ label: string; value: number }>>([]);
  const [rtLastUpdate, setRtLastUpdate] = useState<number>(0);
  const [rtErrorCount, setRtErrorCount] = useState<number>(0);
  const [rtDelay, setRtDelay] = useState<number | null>(null);

  // untuk paksa remount input file agar bisa upload ulang tanpa reload
  const [fileInputKey, setFileInputKey] = useState(0);

  const resetUpload = () => {
    setFiles({
      UTARA: null,
      TIMUR: null,
      SELATAN: null,
      BARAT: null,
    });

    setResp(null);
    setSerialStatus({ ok: null, message: "" });
    setLoading(false);

    // paksa input file remount
    setFileInputKey((k) => k + 1);

    toast({
      status: "info",
      title: "Reset upload",
      description: "Silakan upload 4 gambar baru. Hasilnya akan dipakai 1 cycle berikutnya saja.",
    });
  };

  const onSubmit = async () => {
    if (!canSubmit) {
      toast({
        status: "warning",
        title: "File belum lengkap",
        description: "Upload 4 gambar: UTARA, TIMUR, SELATAN, BARAT.",
      });
      return;
    }

    const fd = new FormData();
    fd.append("model_type", modelType);
    fd.append("utara", files.UTARA as File);
    fd.append("timur", files.TIMUR as File);
    fd.append("selatan", files.SELATAN as File);
    fd.append("barat", files.BARAT as File);

    setLoading(true);
    setResp(null);
    setSerialStatus({ ok: null, message: "" });

    try {
      const r = await fetch(`${API_BASE}/api/process`, {
        method: "POST",
        body: fd,
      });

      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }

      const data = (await r.json()) as ApiResponse;
      setResp(data);
      setOverlayNonce((n) => n + 1); // ✅ paksa gambar reload

      // read serial status
      const port = data.serial_port || "COM?";
      const baud = data.serial_baud ? ` @ ${data.serial_baud}` : "";

      if (data.serial_sent === true) {
        setSerialStatus({
          ok: true,
          message: `✅ Terkirim ke ${port}${baud} (dipakai 1 cycle berikutnya saja; jika tidak upload lagi maka cycle setelahnya kembali DEFAULT)`,
        });
      } else if (data.serial_sent === false) {
        setSerialStatus({
          ok: false,
          message: `❌ Gagal kirim ke ${port}${baud}. Pastikan COM tidak dipakai aplikasi lain (Thonny/Serial Monitor) dan port benar.`,
        });
      } else {
        setSerialStatus({
          ok: null,
          message: "ℹ️ Status serial tidak tersedia (backend belum mengirim serial_sent).",
        });
      }

      toast({
        status: "success",
        title: "Deteksi selesai",
        description: `Model: ${data.model_type.toUpperCase()}`,
      });
    } catch (e: any) {
      const msg = e?.message || "Unknown error";

      setSerialStatus({
        ok: false,
        message: `❌ Gagal: ${msg}`,
      });

      toast({
        status: "error",
        title: "Gagal memproses",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Polling realtime hanya saat TAB realtime aktif
  useEffect(() => {
    if (activeTab !== "realtime") return;
    if (serialReady === false) return;

    let alive = true;

    const fetchRT = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/realtime_pico`, { cache: "no-store" });
        if (!r.ok) return;

        const obj = (await r.json()) as RtPicoResponse;

        const g = obj.schedule || {};
        const rtR = obj.rt_red || {};
        const active = obj.active_arah;
        const remaining = Number(obj.remaining ?? 0) || 0;

        const list: Array<{ label: string; value: number }> = [
          { label: "Green_North", value: Number(g["UTARA"]?.Green_time ?? 0) },
          { label: "Red_North", value: Number(g["UTARA"]?.Red_time ?? 0) },

          { label: "Green_East", value: Number(g["TIMUR"]?.Green_time ?? 0) },
          { label: "Red_East", value: Number(g["TIMUR"]?.Red_time ?? 0) },

          { label: "Green_South", value: Number(g["SELATAN"]?.Green_time ?? 0) },
          { label: "Red_South", value: Number(g["SELATAN"]?.Red_time ?? 0) },

          { label: "Green_West", value: Number(g["BARAT"]?.Green_time ?? 0) },
          { label: "Red_West", value: Number(g["BARAT"]?.Red_time ?? 0) },

          { label: "Green_RT_North", value: active === "UTARA" ? remaining : 0 },
          { label: "Green_RT_East", value: active === "TIMUR" ? remaining : 0 },
          { label: "Green_RT_South", value: active === "SELATAN" ? remaining : 0 },
          { label: "Green_RT_West", value: active === "BARAT" ? remaining : 0 },

          { label: "Red_RT_North", value: Number(rtR["UTARA"] ?? 0) },
          { label: "Red_RT_East", value: Number(rtR["TIMUR"] ?? 0) },
          { label: "Red_RT_South", value: Number(rtR["SELATAN"] ?? 0) },
          { label: "Red_RT_West", value: Number(rtR["BARAT"] ?? 0) },
        ];

        if (alive) {
          setRtData(list);
          setRtLastUpdate(Date.now());
          setRtDelay(obj.delay_ms ?? null);
        }
      } catch {
        setRtErrorCount((c) => c + 1);
      }
    };

    fetchRT();
    const t = setInterval(fetchRT, 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "realtime") return;
    if (serialReady === false) return;
  
    let stop = false;
  
    const ping = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/serial_status`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stop) {
          setSerialReady(!!j.ready);
          setSerialDetail(String(j.detail ?? ""));
        }
      } catch {
        if (!stop) {
          setSerialReady(false);
          setSerialDetail("fetch_error");
        }
      }
    };
  
    ping();
    const t = setInterval(ping, 1500);
  
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [activeTab]);  

  // ====== UI constants ======
  const bgGradient = useColorModeValue(
    "radial-gradient(circle at top left, rgba(99,102,241,0.25) 0, transparent 55%), radial-gradient(circle at bottom right, rgba(13,148,136,0.22) 0, transparent 55%), linear-gradient(#f7fafc, #eef2ff)",
    "radial-gradient(circle at top left, #1d2345 0, transparent 55%), radial-gradient(circle at bottom right, #0f766e 0, transparent 55%), #050816"
  );

  const pageText = useColorModeValue("gray.900", "gray.100");
  const softText = useColorModeValue("gray.600", "rgba(156, 163, 175, 1)");

  const accent = "#6366f1";
  const accent2 = "#a855f7";

  const cardBg = useColorModeValue("rgba(255, 255, 255, 0.82)", "rgba(15, 23, 42, 0.85)");
  const cardBorder = useColorModeValue("1px solid rgba(15, 23, 42, 0.10)", "1px solid rgba(148, 163, 184, 0.25)");
  const cardShadow = useColorModeValue("0 20px 40px rgba(15, 23, 42, 0.12)", "0 20px 40px rgba(15, 23, 42, 0.65)");

  const chipBg = useColorModeValue("rgba(255, 255, 255, 0.9)", "rgba(15, 23, 42, 0.95)");
  const chipBorder = useColorModeValue("1px solid rgba(15, 23, 42, 0.12)", "1px solid rgba(148, 163, 184, 0.6)");
  const chipText = useColorModeValue("gray.700", "gray.300");

  const inputBg = useColorModeValue("rgba(255,255,255,0.95)", "rgba(15, 23, 42, 0.9)");
  const inputBorder = useColorModeValue("1px solid rgba(15, 23, 42, 0.18)", "1px solid rgba(148, 163, 184, 0.6)");
  const fileBorder = useColorModeValue("1px dashed rgba(15, 23, 42, 0.22)", "1px dashed rgba(148, 163, 184, 0.6)");

  const pagePY = { base: isNarrow ? 4 : 5, md: 8, xl: 10 };
  const pagePX = { base: isNarrow ? 2 : 3, md: 6, xl: 8 };
  const cardPad = { base: isNarrow ? 3 : 4, md: 5, xl: 6 };
  const sectionGap = { base: isNarrow ? 4 : 4, md: 6 };
  const gridGap = { base: isNarrow ? 3 : 3, md: 4 };
  const imgH = {
    base: isNarrow ? "180px" : "200px",
    sm: "230px",
    md: "260px",
    xl: "300px",
  };

  // components
  const Card = ({ children }: { children: React.ReactNode }) => (
    <Box
      w="full"
      maxW="100%"
      position="relative"
      bg={cardBg}
      border={cardBorder}
      borderRadius={{ base: "16px", md: "18px" }}
      boxShadow={cardShadow}
      p={cardPad}
      overflow="hidden"
      _before={{
        content: '""',
        position: "absolute",
        inset: "-1px",
        borderRadius: "inherit",
        border: "1px solid transparent",
        background:
          colorMode === "dark"
            ? "linear-gradient(120deg, rgba(99, 102, 241, 0.5), rgba(14, 165, 233, 0.3), transparent)"
            : "linear-gradient(120deg, rgba(99, 102, 241, 0.35), rgba(14, 165, 233, 0.18), transparent)",
        opacity: colorMode === "dark" ? 0.35 : 0.28,
        pointerEvents: "none",
        mask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    >
      {children}
    </Box>
  );

  const Chip = ({ label }: { label: string }) => (
    <Badge
      px={3}
      py={1}
      borderRadius="999px"
      bg={chipBg}
      border={chipBorder}
      color={chipText}
      letterSpacing="0.12em"
      fontSize={{ base: isNarrow ? "8px" : "9px", md: "10px" }}
      whiteSpace="nowrap"
      maxW="100%"
    >
      {label}
    </Badge>
  );

  const SerialStatusBar = () => {
    const okBg = useColorModeValue("rgba(16, 185, 129, 0.12)", "rgba(16, 185, 129, 0.14)");
    const okBorder = useColorModeValue("1px solid rgba(16,185,129,0.25)", "1px solid rgba(16,185,129,0.35)");
  
    const errBg = useColorModeValue("rgba(239, 68, 68, 0.12)", "rgba(239, 68, 68, 0.14)");
    const errBorder = useColorModeValue("1px solid rgba(239,68,68,0.25)", "1px solid rgba(239,68,68,0.35)");
  
    const infoBg = useColorModeValue("rgba(59, 130, 246, 0.10)", "rgba(59, 130, 246, 0.14)");
    const infoBorder = useColorModeValue("1px solid rgba(59,130,246,0.20)", "1px solid rgba(59,130,246,0.32)");
  
    const textColor = useColorModeValue("gray.700", "gray.200");
  
    if (!serialStatus.message) return null;
  
    const bg = serialStatus.ok === true ? okBg : serialStatus.ok === false ? errBg : infoBg;
    const border = serialStatus.ok === true ? okBorder : serialStatus.ok === false ? errBorder : infoBorder;
  
    return (
      <Box mt={2} p={{ base: 3, md: 3 }} borderRadius="14px" bg={bg} border={border} maxW="100%">
        <Text fontSize={{ base: isNarrow ? "12px" : "13px", md: "14px" }} color={textColor} whiteSpace="normal" wordBreak="break-word">
          {serialStatus.message}
        </Text>
      </Box>
    );
  };
  

  const tableSx = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: { base: isNarrow ? "10px" : "11px", md: "12px" },
    background: "transparent",
    tableLayout: isNarrow ? "fixed" : "auto",
  };

  const theadSx = {
    bg: useColorModeValue(
      "linear-gradient(90deg, rgba(238,242,255,1), rgba(199,210,254,0.9))",
      "linear-gradient(90deg, rgba(15, 23, 42, 0.9), rgba(30, 64, 175, 0.7))"
    ),
  };

  const thSx = {
    padding: { base: isNarrow ? "8px 6px" : "9px 10px", md: "10px 12px" },
    textAlign: "center" as const,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    fontSize: { base: isNarrow ? "9px" : "10px", md: "11px" },
    color: useColorModeValue("gray.700", "#e5e7eb"),
    whiteSpace: isNarrow ? "normal" : "nowrap",
    wordBreak: "break-word",
  };

  const tdSx = {
    padding: { base: isNarrow ? "8px 6px" : "9px 10px", md: "10px 12px" },
    textAlign: "center" as const,
    borderTop: useColorModeValue("1px solid rgba(15, 23, 42, 0.10)", "1px solid rgba(31, 41, 55, 0.9)"),
    color: useColorModeValue("gray.700", "#d1d5db"),
    whiteSpace: isNarrow ? "normal" : "nowrap",
    wordBreak: "break-word",
  };

  const rowSx = {
    _even: { bg: useColorModeValue("rgba(255,255,255,0.85)", "rgba(15, 23, 42, 0.85)") },
    _odd: { bg: useColorModeValue("rgba(238,242,255,0.55)", "rgba(15, 23, 42, 0.7)") },
    _hover: { bg: useColorModeValue("rgba(199, 210, 254, 0.60)", "rgba(30, 64, 175, 0.55)") },
  };

  // ✅ TAB BUTTON STYLE
  const tabWrapBg = useColorModeValue("rgba(255,255,255,0.55)", "rgba(15, 23, 42, 0.55)");
  const tabWrapBorder = useColorModeValue("1px solid rgba(15, 23, 42, 0.12)", "1px solid rgba(148, 163, 184, 0.25)");

  const tabBtnBase = {
    flex: 1,
    w: "100%",
    borderRadius: "999px",
    size: "md" as const,
    py: 6,
    fontWeight: 700,
    letterSpacing: "0.02em",
  };

  // ✅ HEADER UI (biar konsisten)
  const headerBadgeProps = {
    px: 3,
    py: 1,
    borderRadius: "999px",
    border: useColorModeValue("1px solid rgba(15, 23, 42, 0.14)", "1px solid rgba(148, 163, 184, 0.4)"),
    bg: useColorModeValue(
      "linear-gradient(120deg, rgba(255,255,255,0.85), rgba(238,242,255,0.65))",
      "linear-gradient(120deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.6))"
    ),
    color: useColorModeValue("gray.700", "gray.300"),
    letterSpacing: "0.12em",
    fontSize: { base: isNarrow ? "8px" : "9px", md: "10px" },
    maxW: "100%",
    whiteSpace: "normal" as const,
    wordBreak: "break-word" as const,
  };

  return (
    <Box minH="100%" py={pagePY} px={pagePX} bg={bgGradient} color={pageText} overflowX="hidden" maxW="100%">
      <Container maxW={{ base: "100%", md: "6xl", "2xl": "7xl" }} px={0}>
        {/* =========================
            TAB BAR (PALING ATAS)
           ========================= */}
        <Box w={{ base: isNarrow ? "93%" : "100%" }} ml={3} mt={0} mb={{ base: 4, md: 6 }}>
          <Box p={2} borderRadius="18px" bg={tabWrapBg} border={tabWrapBorder} backdropFilter="blur(10px)">
            <HStack spacing={2} w="100%">
              <Button
                {...tabBtnBase}
                onClick={() => setActiveTab("detect")}
                variant={activeTab === "detect" ? "solid" : "outline"}
                colorScheme="purple"
              >
                🧠 Detection
              </Button>

              <Button
                {...tabBtnBase}
                onClick={() => setActiveTab("realtime")}
                variant={activeTab === "realtime" ? "solid" : "outline"}
                colorScheme="purple"
              >
                📡 Monitor Pico
              </Button>
            </HStack>
          </Box>

          {/* =========================
              HEADER PER TAB (DI BAWAH TAB)
              mounted + display none/block
             ========================= */}

          {/* Header: Detection */}
          <Box display={activeTab === "detect" ? "block" : "none"} mt={{ base: 4, md: 5 }}>
            <VStack align="start" spacing={{ base: 2, md: 3 }} maxW="100%">
              <Badge {...headerBadgeProps}>{titleBadgeDetect}</Badge>

              <Heading
                fontSize={{ base: "25px", sm: "26px", md: "34px", xl: "40px", "2xl": "44px" }}
                lineHeight={{ base: "1.2", md: "1.15" }}
                maxW="100%"
                whiteSpace="normal"
                wordBreak="break-word"
              >
                🚦 Vehicle Detection 4 Persimpangan
              </Heading>

              <Text
                fontSize={{ base: isNarrow ? "14px" : "13px", md: "14px", xl: "15px" }}
                color={softText}
                maxW={{ base: isNarrow ? "95%" : "100%" }}
                lineHeight="1.7"
                whiteSpace="normal"
                wordBreak="break-word"
                textAlign="justify"
                mt={1}
              >
                Upload 4 gambar persimpangan, pilih model deteksi, sistem akan mendeteksi kendaraan, menghitung PCU,
                lalu menghasilkan durasi hijau &amp; merah berbasis fuzzy logic untuk Raspberry Pi Pico.
              </Text>
            </VStack>
          </Box>

          {/* Header: Monitor Pico */}
          <Box display={activeTab === "realtime" ? "block" : "none"} mt={{ base: 4, md: 5 }}>
            <VStack align="start" spacing={{ base: 2, md: 3 }} maxW="100%">
              <Badge {...headerBadgeProps}>{titleBadgeRealtime}</Badge>

              <Heading
                fontSize={{ base: "25px", sm: "26px", md: "34px", xl: "40px", "2xl": "44px" }}
                lineHeight={{ base: "1.2", md: "1.15" }}
                maxW="100%"
                whiteSpace="normal"
                wordBreak="break-word"
              >
                📡 Real-time Traffic (Pico)
              </Heading>

              <Text
                fontSize={{ base: isNarrow ? "14px" : "13px", md: "14px", xl: "15px" }}
                color={softText}
                maxW={{ base: isNarrow ? "95%" : "100%" }}
                lineHeight="1.7"
                whiteSpace="normal"
                wordBreak="break-word"
                textAlign="justify"
                mt={1}
              >
                Monitor status traffic light dan countdown cycle secara real-time dari Raspberry Pi Pico. Data akan
                diperbarui tiap detik untuk menampilkan durasi hijau/merah per arah serta sisa waktu phase yang sedang aktif.
              </Text>
            </VStack>
          </Box>
        </Box>

        {/* ===== BODY ===== */}
        <VStack align="stretch" spacing={sectionGap} maxW={{ base: isNarrow ? "93%" : "100%" }} ml={3}>
          {/* ===========================
              TAB 1: DETECTION (mounted)
             =========================== */}
          <Box display={activeTab === "detect" ? "block" : "none"}>
            <Card>
              <VStack align="stretch" spacing={{ base: 3, md: 4 }} maxW="100%">
                <HStack justify="space-between" align="start" maxW="100%">
                  <Box maxW="100%">
                    <Heading fontSize={{ base: isNarrow ? "16px" : "18px", md: "20px" }} whiteSpace="normal">
                      📤 Upload 4 Gambar Persimpangan
                    </Heading>
                    <Text mt={1} fontSize={{ base: isNarrow ? "12px" : "13px", md: "14px" }} color={softText} whiteSpace="normal">
                      Setiap file merepresentasikan 1 arah persimpangan.
                    </Text>
                  </Box>

                  <Button
                    onClick={resetUpload}
                    leftIcon={<FaRepeat />}
                    isDisabled={loading}
                    size="sm"
                    borderRadius="14px"
                    px={4}
                    bg={useColorModeValue("rgba(255,255,255,0.85)", "rgba(15, 23, 42, 0.75)")}
                    border={useColorModeValue("1px solid rgba(15, 23, 42, 0.14)", "1px solid rgba(148, 163, 184, 0.35)")}
                    _hover={{
                      borderColor: accent,
                      transform: "translateY(-1px)",
                      boxShadow: useColorModeValue("0 10px 20px rgba(15, 23, 42, 0.10)", "0 10px 20px rgba(0,0,0,0.35)"),
                    }}
                    _active={{ transform: "translateY(0)" }}
                  >
                    Upload Ulang
                  </Button>
                </HStack>

                <FormControl>
                  <FormLabel fontSize="11px" letterSpacing="0.12em" color={softText} textTransform="uppercase">
                    Model Deteksi
                  </FormLabel>

                  <Select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value as ModelType)}
                    bg={inputBg}
                    border={inputBorder}
                    borderRadius="12px"
                    color={useColorModeValue("gray.800", "gray.100")}
                    fontSize={{ base: isNarrow ? "13px" : "14px", md: "14px" }}
                    _focus={{ borderColor: accent, boxShadow: "0 0 0 1px rgba(99, 102, 241, 0.35)" }}
                  >
                    <option value="yolo">YOLO (Best Model)</option>
                    <option value="fcos">FCOS</option>
                    <option value="rtdetr">RT-DETR</option>
                  </Select>
                </FormControl>

                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={gridGap} maxW="100%">
                  {DIRS.map((dir) => (
                    <FormControl key={dir}>
                      <FormLabel fontSize="11px" letterSpacing="0.12em" color={softText} textTransform="uppercase">
                        {dir}
                      </FormLabel>

                      <Box
                        position="relative"
                        p={{ base: isNarrow ? 2.5 : 3, md: 3 }}
                        borderRadius="12px"
                        bg={inputBg}
                        border={fileBorder}
                        maxW="100%"
                        _hover={{
                          borderStyle: "solid",
                          borderColor: accent,
                          bg: useColorModeValue("rgba(255,255,255,0.98)", "rgba(15, 23, 42, 0.95)"),
                          boxShadow: "0 0 0 1px rgba(99, 102, 241, 0.25)",
                        }}
                      >
                        <Text fontSize={{ base: isNarrow ? "11px" : "12px", md: "13px" }} color={softText} whiteSpace="normal" wordBreak="break-word">
                          {prettyFileName(files[dir])}
                        </Text>

                        <Input
                          key={`${dir}-${fileInputKey}`}
                          type="file"
                          accept="image/*"
                          onClick={(e) => {
                            (e.currentTarget as HTMLInputElement).value = "";
                          }}
                          onChange={(e) => onPickFile(dir, e.target.files?.[0] || null)}
                          position="absolute"
                          inset={0}
                          opacity={0}
                          cursor="pointer"
                        />
                      </Box>
                    </FormControl>
                  ))}
                </SimpleGrid>

                <VStack align="stretch" spacing={2} pt={1} maxW="100%">
                  <Button
                    onClick={onSubmit}
                    isDisabled={!canSubmit || loading}
                    borderRadius="999px"
                    w="100%"
                    bgGradient={`radial(circle at top left, ${accent2}, ${accent})`}
                    color="white"
                    fontSize={{ base: isNarrow ? "13px" : "14px", md: "14px" }}
                    boxShadow={useColorModeValue("0 14px 30px rgba(99, 102, 241, 0.25)", "0 14px 30px rgba(99, 102, 241, 0.45)")}
                    _hover={{
                      transform: "translateY(-1px) scale(1.01)",
                      boxShadow: useColorModeValue("0 18px 34px rgba(99, 102, 241, 0.32)", "0 18px 34px rgba(99, 102, 241, 0.6)"),
                    }}
                    _active={{ transform: "translateY(0) scale(0.99)" }}
                  >
                    {loading ? (
                      <HStack>
                        <Spinner size="sm" />
                        <Text>Memproses...</Text>
                      </HStack>
                    ) : (
                      "🔎 Proses Deteksi"
                    )}
                  </Button>

                  {!canSubmit && (
                    <Text fontSize={{ base: "12px", md: "13px" }} color={softText}>
                      *Upload 4 gambar dulu
                    </Text>
                  )}

                  <SerialStatusBar />
                </VStack>
              </VStack>
            </Card>

            {/* Hasil deteksi + tabel hanya tampil kalau sudah ada resp */}
            {resp && (
              <>
                <Box maxW="100%">
                  <br />
                  <Heading fontSize={{ base: isNarrow ? "16px" : "18px", md: "20px" }} whiteSpace="normal">
                    📸 Hasil Deteksi {resp.model_type ? resp.model_type.toUpperCase() : "YOLO"}
                  </Heading>
                  <Text mt={1} fontSize={{ base: isNarrow ? "12px" : "13px", md: "14px" }} color={softText} whiteSpace="normal">
                    Visualisasi bounding box tiap arah persimpangan.
                  </Text>
                  <br />
                </Box>

                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={gridGap} maxW="100%">
                  {DIRS.map((dir) => {
                    const r = resp.results?.[dir];
                    const overlayUrl = r?.overlay_url ? `${API_BASE}${r.overlay_url}?v=${overlayNonce}` : null;

                    return (
                      <Card key={dir}>
                        <VStack align="stretch" spacing={3} maxW="100%">
                          <HStack justify="space-between" maxW="100%">
                            <Chip label={dir} />
                            {r?.error && (
                              <Badge colorScheme="red" variant="subtle" fontSize="xs" maxW="60%" whiteSpace="normal" wordBreak="break-word">
                                {r.error}
                              </Badge>
                            )}
                          </HStack>

                          {overlayUrl ? (
                            <Image
                              src={overlayUrl}
                              alt={`Deteksi ${dir}`}
                              w="100%"
                              maxW="100%"
                              h={imgH}
                              objectFit="contain"
                              borderRadius="12px"
                              border={useColorModeValue("1px solid rgba(15, 23, 42, 0.12)", "1px solid rgba(15, 23, 42, 0.9)")}
                            />
                          ) : (
                            <Box
                              h={imgH}
                              borderRadius="12px"
                              border={useColorModeValue("1px solid rgba(15, 23, 42, 0.12)", "1px solid rgba(148, 163, 184, 0.25)")}
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              color={softText}
                              fontSize="sm"
                              maxW="100%"
                            >
                              Tidak ada overlay
                            </Box>
                          )}
                        </VStack>
                      </Card>
                    );
                  })}
                </SimpleGrid>

                <Divider opacity={useColorModeValue(0.35, 0.2)} />

                <Box maxW="100%">
                  <br />
                  <Heading fontSize={{ base: isNarrow ? "16px" : "18px", md: "20px" }} whiteSpace="normal">
                    📊 Tabel PCU
                  </Heading>
                  <Text mt={1} fontSize={{ base: isNarrow ? "12px" : "13px", md: "14px" }} color={softText} whiteSpace="normal">
                    Perhitungan PCU berdasarkan jumlah kendaraan.
                  </Text>
                  <br />
                </Box>

                <Card>
                  <Box
                    sx={{
                      borderRadius: "18px",
                      overflow: "hidden",
                      border: useColorModeValue("1px solid rgba(15, 23, 42, 0.12)", "1px solid rgba(148, 163, 184, 0.25)"),
                      background: useColorModeValue("rgba(255,255,255,0.6)", "transparent"),
                      maxW: "100%",
                    }}
                  >
                    <Box overflowX="auto">
                      <Table variant="unstyled" sx={tableSx}>
                        <Thead sx={theadSx}>
                          <Tr>
                            <Th sx={thSx}>Arah</Th>
                            <Th sx={thSx}>PCU</Th>
                            <Th sx={thSx}>Car</Th>
                            <Th sx={thSx}>Motor</Th>
                            <Th sx={thSx}>Bicycle</Th>
                            <Th sx={thSx}>Kendaraan Besar</Th>
                          </Tr>
                        </Thead>

                        <Tbody>
                          {DIRS.map((dir) => {
                            const row = resp.pcu_table?.[dir];
                            return (
                              <Tr key={dir} sx={rowSx}>
                                <Td sx={tdSx}>{dir}</Td>
                                <Td sx={tdSx}>{row?.PCU_total ?? "-"}</Td>
                                <Td sx={tdSx}>{row?.car ?? "-"}</Td>
                                <Td sx={tdSx}>{row?.motorcycle ?? "-"}</Td>
                                <Td sx={tdSx}>{row?.bicycle ?? "-"}</Td>
                                <Td sx={tdSx}>{row?.kendaraan_besar ?? "-"}</Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>
                </Card>

                <Box maxW="100%">
                  <br />
                  <Heading fontSize={{ base: isNarrow ? "16px" : "18px", md: "20px" }} whiteSpace="normal">
                    ⏱ Durasi Hijau &amp; Merah (Fuzzy Logic)
                  </Heading>
                  <Text mt={1} fontSize={{ base: isNarrow ? "12px" : "13px", md: "14px" }} color={softText} whiteSpace="normal">
                    Output timing yang akan dikirim ke Raspberry Pi Pico.
                  </Text>
                  <br />
                </Box>

                <Card>
                  <Box
                    sx={{
                      borderRadius: "18px",
                      overflow: "hidden",
                      border: useColorModeValue("1px solid rgba(15, 23, 42, 0.12)", "1px solid rgba(148, 163, 184, 0.25)"),
                      background: useColorModeValue("rgba(255,255,255,0.6)", "transparent"),
                      maxW: "100%",
                    }}
                  >
                    <Box overflowX="auto">
                      <Table variant="unstyled" sx={tableSx}>
                        <Thead sx={theadSx}>
                          <Tr>
                            <Th sx={thSx}>Arah</Th>
                            <Th sx={thSx}>Hijau (detik)</Th>
                            <Th sx={thSx}>Merah (detik)</Th>
                          </Tr>
                        </Thead>

                        <Tbody>
                          {DIRS.map((dir) => {
                            const row = resp.fuzzy_table?.[dir];
                            return (
                              <Tr key={dir} sx={rowSx}>
                                <Td sx={tdSx}>{dir}</Td>
                                <Td sx={tdSx}>{row?.Green_time ?? "-"}</Td>
                                <Td sx={tdSx}>{row?.Red_time ?? "-"}</Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>
                </Card>
              </>
            )}
          </Box>

          <HStack
            mt={2}
            spacing={3}
            opacity={0.8}
            color={softText}
            fontSize={{ base: isNarrow ? "11px" : "12px", md: "13px" }}
            flexWrap="wrap"
            maxW="100%"
          >
            <Box
              w="8px"
              h="8px"
              borderRadius="999px"
              bg={accent}
              boxShadow={useColorModeValue(`0 0 14px rgba(99,102,241,0.35)`, `0 0 16px ${accent}`)}
            />
            <Text whiteSpace="normal" wordBreak="break-word">
              Edge-AI • Deteksi Multi-Model • Fuzzy • Raspberry Pi Pico
            </Text>
          </HStack>

          {/* ===========================
              TAB 2: REALTIME (mounted)
             =========================== */}
          <Box display={activeTab === "realtime" ? "block" : "none"}>
            <Box maxW="100%">
              <Heading fontSize={{ base: isNarrow ? "16px" : "18px", md: "20px" }} whiteSpace="normal">
                Real-time Traffic (Pico)
              </Heading>
              <Text mt={1} fontSize={{ base: isNarrow ? "12px" : "13px", md: "14px" }} color={softText} whiteSpace="normal">
                Nilai real-time untuk tiap arah (diambil dari Pico).
              </Text>

              <Text fontSize="xs" opacity={0.8}>
                Serial:{" "}
                {serialReady === null ? (
                  "checking..."
                ) : serialReady ? (
                  <Box as="span" color="green.400" fontWeight="semibold">✅ COM9 ready</Box>
                ) : (
                  <Box as="span" color="red.400" fontWeight="semibold">❌ COM9 not ready ({serialDetail})</Box>
                )}
              </Text>

              <Text fontSize="xs" opacity={0.7}>
                Last Updated: {rtLastUpdate ? new Date(rtLastUpdate).toLocaleTimeString() : "-"}
                {" | "}
                Delay:{" "}
                {rtDelay !== null ? (
                  <Box
                    as="span"
                    color={rtDelay < 500 ? "green.400" : rtDelay < 1500 ? "yellow.400" : "red.400"}
                    fontWeight="semibold"
                  >
                    {rtDelay} ms
                  </Box>
                ) : (
                  "-"
                )}
                {" • "}
                errors: {rtErrorCount}
              </Text>
              <br />
            </Box>

            <Card>
              <Box
                sx={{
                  borderRadius: "18px",
                  overflow: "hidden",
                  border: useColorModeValue("1px solid rgba(15, 23, 42, 0.12)", "1px solid rgba(148, 163, 184, 0.25)"),
                  background: useColorModeValue("rgba(255,255,255,0.6)", "transparent"),
                  maxW: "100%",
                  p: { base: isNarrow ? 3 : 4, md: 5 },
                }}
              >
                <SimpleGrid columns={{ base: 2, sm: 4 }} spacing={{ base: 4, md: 6 }} maxW="100%">
                  {rtData.map((it) => (
                    <Box key={it.label} minW={0}>
                      <Text
                        fontSize={{ base: isNarrow ? "11px" : "12px", md: "13px" }}
                        color={softText}
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {it.label}
                      </Text>
                      <Text fontSize={{ base: isNarrow ? "20px" : "22px", md: "26px" }} fontWeight="semibold" lineHeight="1.1">
                        {it.value}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            </Card>

            
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
