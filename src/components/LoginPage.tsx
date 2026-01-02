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
import { login } from "../auth";

interface Props {
  onLogin: () => void;
  goRegister: () => void;
}

const LoginPage = ({ onLogin, goRegister }: Props) => {
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const bgGradient = useColorModeValue(
    "radial-gradient(circle at top left, rgba(99,102,241,0.25) 0, transparent 55%), radial-gradient(circle at bottom right, rgba(13,148,136,0.22) 0, transparent 55%), linear-gradient(#f7fafc, #eef2ff)",
    "radial-gradient(circle at top left, #1d2345 0, transparent 55%), radial-gradient(circle at bottom right, #0f766e 0, transparent 55%), #050816"
  );

  const footerColor = useColorModeValue("gray.700", "whiteAlpha.900");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const ok = login(nik, password);

    if (!ok) {
      setError("NIK atau password salah");
      return;
    }

    onLogin();
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
              SIGMA — LOGIN
            </Text>

            {error && (
              <Text color="red.500" fontSize="sm">
                {error}
              </Text>
            )}

            <Input
              placeholder="NIK"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button colorScheme="blue" w="100%" onClick={handleSubmit}>
              Login
            </Button>

            <Text fontSize="sm">
              Belum pernah register?{" "}
              <Link color="blue.500" onClick={goRegister}>
                Register
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

export default LoginPage;
