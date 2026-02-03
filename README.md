This project is a traffic light optimization system based on vehicle detection, PCU calculation, and automatic signal duration adjustment using Fuzzy Logic. This system combines a computer vision model, cloud server, and IoT microcontroller to produce adaptive and real-time traffic light settings.

Project Objectives :

- Create an artificial intelligence-based adaptive traffic light system simulation
- Reduce traffic congestion using PCU calculations and fuzzy logic
- Integrate AI and IoT models into one complete system
- Compare the performance of various detection models (YOLO vs RT-DETR vs FCOS)

System Integration Flow : 
1) Clone repository:
   ```bash
   git clone https://github.com/Dard1ka/ITCS_Concept_React_IOT_FASTAPI.git
   cd ITCS_Concept_React_IOT_FASTAPI
   ```
BACKEND : 
2) Install Dependencies:
   ```bash
   cd back-end
   pip install -r requirements.txt
   ```
3) Download the Model : https://drive.google.com/drive/folders/1LoBMdpaH8AoIUlJ-gnw8KFp8N_sCvl3M?usp=sharing
4) Run the local Server :
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```
5) Run the local Server : http://localhost:8000

FRONTEND : 
6) Install Dependencies: 
   ```bash
   cd ../front-end
   npm install
   ```
7) Run React App:
   ```bash
   npm run dev
   ```
8) Open :
   http://localhost:5173 

How It Works (Workflow)
1. User uploads 4 intersection images (North / East / South / West) via React UI
2. React sends images to FastAPI endpoint (example: /api/process)
3. Backend runs object detection and counts vehicles per direction
4. Counts are converted to PCU (Passenger Car Unit) values
5. Fuzzy Logic Controller computes the optimal green/red durations
6. Backend returns:
   - overlay images (bounding boxes)
   - vehicle counts per class
   - PCU table
   - fuzzy decision table (green/red time)
7. Final durations are sent to the IoT controller (Pico/ESP) to actuate traffic lights

IoT Mode (Hardware Controller)
Hardware:
- Raspberry Pi Pico (or Pico W)
- ESP-01S WiFi module (or direct WiFi if Pico W)
- 4-direction traffic lights (Red/Yellow/Green LEDs)
Communication options:
- Serial (USB) from backend → Pico
- WiFi (HTTP / TCP) backend → ESP/Pico

Output
Overlay results saved into:
- back-end/static/output/ (or your output folder)
Frontend displays:
- detected vehicles per direction
- PCU totals
- fuzzy timing results
- traffic light status (optional realtime).
  
