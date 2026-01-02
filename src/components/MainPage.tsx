import { useMemo, useState } from "react";
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
} from "@chakra-ui/react";

type ModelType = "yolo" | "fcos" | "rtdetr";

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
};

const DIRS = ["UTARA", "TIMUR", "SELATAN", "BARAT"] as const;

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function MainPage() {
  const toast = useToast();
  const { colorMode } = useColorMode();

  const [modelType, setModelType] = useState<ModelType>("yolo");
  const [files, setFiles] = useState<
    Record<(typeof DIRS)[number], File | null>
  >({
    UTARA: null,
    TIMUR: null,
    SELATAN: null,
    BARAT: null,
  });

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ApiResponse | null>(null);

  const titleBadge = useMemo(
    () => `Smart Traffic • ${modelType.toUpperCase()} + Fuzzy`,
    [modelType]
  );

  const onPickFile = (dir: (typeof DIRS)[number], f: File | null) => {
    setFiles((prev) => ({ ...prev, [dir]: f }));
  };

  const canSubmit = useMemo(
    () => DIRS.every((d) => files[d] instanceof File),
    [files]
  );
  const prettyFileName = (f: File | null) => (f ? f.name : "Pilih file");

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

      toast({
        status: "success",
        title: "Deteksi selesai",
        description: `Model: ${data.model_type.toUpperCase()}`,
      });
    } catch (e: any) {
      toast({
        status: "error",
        title: "Gagal memproses",
        description: e?.message || "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const bgGradient = useColorModeValue(
    "radial-gradient(circle at top left, rgba(99,102,241,0.25) 0, transparent 55%), radial-gradient(circle at bottom right, rgba(13,148,136,0.22) 0, transparent 55%), linear-gradient(#f7fafc, #eef2ff)",
    "radial-gradient(circle at top left, #1d2345 0, transparent 55%), radial-gradient(circle at bottom right, #0f766e 0, transparent 55%), #050816"
  );

  const pageText = useColorModeValue("gray.900", "gray.100");
  const softText = useColorModeValue("gray.600", "rgba(156, 163, 175, 1)");

  const accent = "#6366f1";
  const accent2 = "#a855f7";

  const cardBg = useColorModeValue(
    "rgba(255, 255, 255, 0.82)",
    "rgba(15, 23, 42, 0.85)"
  );
  const cardBorder = useColorModeValue(
    "1px solid rgba(15, 23, 42, 0.10)",
    "1px solid rgba(148, 163, 184, 0.25)"
  );
  const cardShadow = useColorModeValue(
    "0 20px 40px rgba(15, 23, 42, 0.12)",
    "0 20px 40px rgba(15, 23, 42, 0.65)"
  );

  const chipBg = useColorModeValue(
    "rgba(255, 255, 255, 0.9)",
    "rgba(15, 23, 42, 0.95)"
  );
  const chipBorder = useColorModeValue(
    "1px solid rgba(15, 23, 42, 0.12)",
    "1px solid rgba(148, 163, 184, 0.6)"
  );
  const chipText = useColorModeValue("gray.700", "gray.300");

  const inputBg = useColorModeValue(
    "rgba(255,255,255,0.95)",
    "rgba(15, 23, 42, 0.9)"
  );
  const inputBorder = useColorModeValue(
    "1px solid rgba(15, 23, 42, 0.18)",
    "1px solid rgba(148, 163, 184, 0.6)"
  );
  const fileBorder = useColorModeValue(
    "1px dashed rgba(15, 23, 42, 0.22)",
    "1px dashed rgba(148, 163, 184, 0.6)"
  );

  const Card = ({ children }: { children: React.ReactNode }) => (
    <Box
      position="relative"
      bg={cardBg}
      border={cardBorder}
      borderRadius="18px"
      boxShadow={cardShadow}
      p={{ base: 4, md: 5 }}
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
      fontSize="10px"
    >
      {label}
    </Badge>
  );

  const tableShellSx = {
    borderRadius: "18px",
    overflow: "hidden",
    border: useColorModeValue(
      "1px solid rgba(15, 23, 42, 0.12)",
      "1px solid rgba(148, 163, 184, 0.25)"
    ),
    background: useColorModeValue("rgba(255,255,255,0.6)", "transparent"),
  };

  const tableSx = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
    background: "transparent",
  };

  const theadSx = {
    bg: useColorModeValue(
      "linear-gradient(90deg, rgba(238,242,255,1), rgba(199,210,254,0.9))",
      "linear-gradient(90deg, rgba(15, 23, 42, 0.9), rgba(30, 64, 175, 0.7))"
    ),
  };

  const thSx = {
    padding: "10px 12px",
    textAlign: "center",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    fontSize: "11px",
    color: useColorModeValue("gray.700", "#e5e7eb"),
  };

  const tdSx = {
    padding: "10px 12px",
    textAlign: "center",
    borderTop: useColorModeValue(
      "1px solid rgba(15, 23, 42, 0.10)",
      "1px solid rgba(31, 41, 55, 0.9)"
    ),
    color: useColorModeValue("gray.700", "#d1d5db"),
  };

  const rowSx = {
    _even: {
      bg: useColorModeValue("rgba(255,255,255,0.85)", "rgba(15, 23, 42, 0.85)"),
    },
    _odd: {
      bg: useColorModeValue("rgba(238,242,255,0.55)", "rgba(15, 23, 42, 0.7)"),
    },
    _hover: {
      bg: useColorModeValue(
        "rgba(199, 210, 254, 0.60)",
        "rgba(30, 64, 175, 0.55)"
      ),
    },
  };

  return (
    <Box
      minH="100%"
      py={8}
      px={{ base: 2, md: 6 }}
      bg={bgGradient}
      color={pageText}
    >
      <Container maxW="6xl">
        <VStack align="start" spacing={3} mb={8}>
          <Badge
            px={3}
            py={1}
            borderRadius="999px"
            border={useColorModeValue(
              "1px solid rgba(15, 23, 42, 0.14)",
              "1px solid rgba(148, 163, 184, 0.4)"
            )}
            bg={useColorModeValue(
              "linear-gradient(120deg, rgba(255,255,255,0.85), rgba(238,242,255,0.65))",
              "linear-gradient(120deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.6))"
            )}
            color={useColorModeValue("gray.700", "gray.300")}
            letterSpacing="0.12em"
            fontSize="10px"
          >
            {titleBadge}
          </Badge>

          <Heading size="lg">🚦 Vehicle Detection 4 Persimpangan</Heading>
          <Text fontSize="sm" color={softText} maxW="640px" lineHeight="1.7">
            Upload 4 gambar persimpangan, pilih model deteksi, sistem akan
            mendeteksi kendaraan, menghitung PCU, lalu menghasilkan durasi hijau
            &amp; merah berbasis fuzzy logic untuk Raspberry Pi Pico.
          </Text>
        </VStack>

        <VStack align="stretch" spacing={6}>
          <Card>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Heading size="md">📤 Upload 4 Gambar Persimpangan</Heading>
                <Text mt={1} fontSize="sm" color={softText}>
                  Setiap file merepresentasikan 1 arah persimpangan.
                </Text>
              </Box>

              <FormControl>
                <FormLabel
                  fontSize="11px"
                  letterSpacing="0.12em"
                  color={softText}
                  textTransform="uppercase"
                >
                  Model Deteksi
                </FormLabel>

                <Select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as ModelType)}
                  bg={inputBg}
                  border={inputBorder}
                  borderRadius="12px"
                  color={useColorModeValue("gray.800", "gray.100")}
                  _focus={{
                    borderColor: accent,
                    boxShadow: "0 0 0 1px rgba(99, 102, 241, 0.35)",
                  }}
                >
                  <option value="yolo">YOLO (Best Model)</option>
                  <option value="fcos">FCOS</option>
                  <option value="rtdetr">RT-DETR</option>
                </Select>
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {DIRS.map((dir) => (
                  <FormControl key={dir}>
                    <FormLabel
                      fontSize="11px"
                      letterSpacing="0.12em"
                      color={softText}
                      textTransform="uppercase"
                    >
                      {dir}
                    </FormLabel>

                    <Box
                      position="relative"
                      p={3}
                      borderRadius="12px"
                      bg={inputBg}
                      border={fileBorder}
                      _hover={{
                        borderStyle: "solid",
                        borderColor: accent,
                        bg: useColorModeValue(
                          "rgba(255,255,255,0.98)",
                          "rgba(15, 23, 42, 0.95)"
                        ),
                        boxShadow: "0 0 0 1px rgba(99, 102, 241, 0.25)",
                      }}
                    >
                      <Text fontSize="sm" color={softText}>
                        {prettyFileName(files[dir])}
                      </Text>

                      <Input
                        type="file"
                        accept="image/*"
                        required
                        onChange={(e) =>
                          onPickFile(dir, e.target.files?.[0] || null)
                        }
                        position="absolute"
                        inset={0}
                        opacity={0}
                        cursor="pointer"
                      />
                    </Box>
                  </FormControl>
                ))}
              </SimpleGrid>

              <HStack>
                <Button
                  onClick={onSubmit}
                  isDisabled={!canSubmit || loading}
                  borderRadius="999px"
                  bgGradient={`radial(circle at top left, ${accent2}, ${accent})`}
                  color="white"
                  boxShadow={useColorModeValue(
                    "0 14px 30px rgba(99, 102, 241, 0.25)",
                    "0 14px 30px rgba(99, 102, 241, 0.45)"
                  )}
                  _hover={{
                    transform: "translateY(-1px) scale(1.01)",
                    boxShadow: useColorModeValue(
                      "0 18px 34px rgba(99, 102, 241, 0.32)",
                      "0 18px 34px rgba(99, 102, 241, 0.6)"
                    ),
                  }}
                  _active={{
                    transform: "translateY(0) scale(0.99)",
                  }}
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
                  <Text fontSize="sm" color={softText}>
                    *Upload 4 gambar dulu
                  </Text>
                )}
              </HStack>
            </VStack>
          </Card>

          {resp && (
            <>
              <Box>
                <Heading size="md">
                  📸 Hasil Deteksi{" "}
                  {resp.model_type ? resp.model_type.toUpperCase() : "YOLO"}
                </Heading>
                <Text mt={1} fontSize="sm" color={softText}>
                  Visualisasi bounding box tiap arah persimpangan.
                </Text>
              </Box>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {DIRS.map((dir) => {
                  const r = resp.results?.[dir];
                  const overlayUrl = r?.overlay_url
                    ? `${API_BASE}${r.overlay_url}`
                    : null;

                  return (
                    <Card key={dir}>
                      <VStack align="stretch" spacing={3}>
                        <HStack justify="space-between">
                          <Chip label={dir} />
                          {r?.error && (
                            <Badge colorScheme="red" variant="subtle">
                              {r.error}
                            </Badge>
                          )}
                        </HStack>

                        {overlayUrl ? (
                          <Image
                            src={overlayUrl}
                            alt={`Deteksi ${dir}`}
                            w="100%"
                            h="260px"
                            objectFit="contain"
                            borderRadius="12px"
                            border={useColorModeValue(
                              "1px solid rgba(15, 23, 42, 0.12)",
                              "1px solid rgba(15, 23, 42, 0.9)"
                            )}
                          />
                        ) : (
                          <Box
                            h="260px"
                            borderRadius="12px"
                            border={useColorModeValue(
                              "1px solid rgba(15, 23, 42, 0.12)",
                              "1px solid rgba(148, 163, 184, 0.25)"
                            )}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            color={softText}
                            fontSize="sm"
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

              <Box>
                <Heading size="md">📊 Tabel PCU</Heading>
                <Text mt={1} fontSize="sm" color={softText}>
                  Perhitungan PCU berdasarkan jumlah kendaraan.
                </Text>
              </Box>

              <Card>
                <Box sx={tableShellSx}>
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

              <Box>
                <Heading size="md">
                  ⏱ Durasi Hijau &amp; Merah (Fuzzy Logic)
                </Heading>
                <Text mt={1} fontSize="sm" color={softText}>
                  Output timing yang akan dikirim ke Raspberry Pi Pico.
                </Text>
              </Box>

              <Card>
                <Box sx={tableShellSx}>
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

              <HStack
                mt={2}
                spacing={3}
                opacity={0.8}
                color={softText}
                fontSize="sm"
              >
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="999px"
                  bg={accent}
                  boxShadow={useColorModeValue(
                    `0 0 14px rgba(99,102,241,0.35)`,
                    `0 0 16px ${accent}`
                  )}
                />
                <Text>
                  Edge-AI • Deteksi Multi-Model • Fuzzy • Raspberry Pi Pico
                </Text>
              </HStack>
            </>
          )}
        </VStack>
      </Container>
    </Box>
  );
}
