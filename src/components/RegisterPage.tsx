import {
  Box,
  Button,
  Input,
  VStack,
  Text,
  Card,
  CardBody,
  useColorModeValue,
  Link,
} from "@chakra-ui/react";
import { useState } from "react";
import { addUser, getUsers } from "../auth";

interface Props {
  onRegistered: () => void;
  goLogin: () => void;
}

const RegisterPage = ({ onRegistered, goLogin }: Props) => {
  const [name, setName] = useState("");
  const [nik, setNik] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");

  const bgGradient = useColorModeValue(
    "radial-gradient(circle at top left, rgba(99,102,241,0.25) 0, transparent 55%), radial-gradient(circle at bottom right, rgba(13,148,136,0.22) 0, transparent 55%), linear-gradient(#f7fafc, #eef2ff)",
    "radial-gradient(circle at top left, #1d2345 0, transparent 55%), radial-gradient(circle at bottom right, #0f766e 0, transparent 55%), #050816"
  );
  const footerColor = useColorModeValue("gray.700", "whiteAlpha.900");

  const isValidName = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return false;
    return /^[A-Za-zÀ-ÖØ-öø-ÿ ]+$/.test(trimmed);
  };

  const isValidNik = (s: string) => /^\d{16}$/.test(s);

  const isValidEmail = (s: string) => {
    const trimmed = s.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (
      !name.trim() ||
      !nik.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError("Semua field wajib diisi");
      return;
    }

    if (!isValidName(name)) {
      setError("Nama lengkap hanya boleh berisi huruf dan spasi");
      return;
    }

    if (!isValidNik(nik)) {
      setError("NIK harus berupa 16 digit angka");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Format email tidak valid");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sama dengan password");
      return;
    }

    const users = getUsers();
    const exists = users.find((u) => u.nik === nik);
    if (exists) {
      setError("NIK sudah terdaftar");
      return;
    }

    addUser({
      name: name.trim(),
      nik: nik.trim(),
      email: email.trim(),
      password,
    });

    localStorage.setItem("loggedIn", "true");
    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        name: name.trim(),
        nik: nik.trim(),
        email: email.trim(),
      })
    );

    onRegistered();
  }

  return (
    <Box
      minH="100vh"
      bg={bgGradient}
      display="flex"
      justifyContent="center"
      alignItems="center"
      position="relative"
      px={4}
    >
      <Card w="350px" borderRadius="xl">
        <CardBody>
          <VStack spacing={4}>
            <Text fontSize="2xl" fontWeight="bold">
              SIGMA — Register
            </Text>

            {error && (
              <Text color="red.500" fontSize="sm" textAlign="center">
                {error}
              </Text>
            )}

            <Input
              placeholder="Nama Lengkap"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              placeholder="NIK (16 digit angka)"
              value={nik}
              onChange={(e) =>
                setNik(e.target.value.replace(/\D/g, "").slice(0, 16))
              }
              inputMode="numeric"
            />

            <Input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <Button colorScheme="blue" w="100%" onClick={handleSubmit}>
              Register
            </Button>

            <Text fontSize="sm">
              Sudah pernah register?{" "}
              <Link color="blue.500" onClick={goLogin}>
                Login
              </Link>
            </Text>
          </VStack>
        </CardBody>
      </Card>

      <Text
        position="absolute"
        bottom="10px"
        color={footerColor}
        fontWeight="medium"
      >
        Copyright © 2025 - SIGMA - CORECEPT
      </Text>
    </Box>
  );
};

export default RegisterPage;
