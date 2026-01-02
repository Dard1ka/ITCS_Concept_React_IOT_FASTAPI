import {
  Grid,
  GridItem,
  HStack,
  Text,
  VStack,
  Box,
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { MdLogout } from "react-icons/md";
import ColorModeSwitch from "./ColorModeSwitch";
import { logout, getCurrentUser } from "../auth";

const greetings = [
  "السلام عليكم",
  "Halo",
  "Hi",
  "こんにちは",
  "您好",
  "Bonjour",
  "Aloha",
  "Ciao",
  "नमस्ते",
  "안녕하세요",
];

const NavBar = () => {
  const [index, setIndex] = useState(0);
  const [display, setDisplay] = useState("");
  const [deleting, setDeleting] = useState(false);

  const user = getCurrentUser();

  const typingSpeed = 120;
  const deletingSpeed = 70;
  const pauseAfterType = 900;
  const pauseAfterDelete = 300;

  useEffect(() => {
    const current = greetings[index];

    if (!deleting && display.length < current.length) {
      const t = setTimeout(
        () => setDisplay(current.slice(0, display.length + 1)),
        typingSpeed
      );
      return () => clearTimeout(t);
    }

    if (!deleting && display.length === current.length) {
      const t = setTimeout(() => setDeleting(true), pauseAfterType);
      return () => clearTimeout(t);
    }

    if (deleting && display.length > 0) {
      const t = setTimeout(
        () => setDisplay(display.slice(0, display.length - 1)),
        deletingSpeed
      );
      return () => clearTimeout(t);
    }

    if (deleting && display.length === 0) {
      const t = setTimeout(() => {
        setDeleting(false);
        setIndex((p) => (p + 1) % greetings.length);
      }, pauseAfterDelete);
      return () => clearTimeout(t);
    }
  }, [display, deleting, index]);

  const bg = useColorModeValue("white", "#0a1b2e");
  const textColor = useColorModeValue("black", "white");
  const accent = useColorModeValue("gray.700", "gray.200");

  return (
    <Grid
      bg={bg}
      color={textColor}
      padding="10px 14px"
      minH="100px"
      w="100%"
      templateColumns="auto 1fr"
      templateRows="auto auto"
      columnGap={4}
      alignItems="center"
    >
      <GridItem rowSpan={2} alignSelf="center">
        <Text fontWeight="bold" fontSize="2xl">
          SIGMA
        </Text>
      </GridItem>

      <GridItem justifySelf="end">
        <HStack spacing={4}>
          <ColorModeSwitch />

          <Box
            fontWeight="semibold"
            fontSize="lg"
            color={accent}
            minW="120px"
            textAlign="right"
            whiteSpace="nowrap"
            position="relative"
          >
            {display}
            <Box
              as="span"
              ml="2px"
              display="inline-block"
              width="1px"
              height="1.1em"
              bg="gray.600"
              transform="translateY(3px)"
              animation="blink 0.75s steps(2, start) infinite"
            />
          </Box>

          <VStack spacing={0} align="flex-end">
            <Text fontWeight="semibold">{user ? user.name : "Guest"}</Text>

            <Text fontSize="sm" opacity={0.75}>
              {user ? user.email : "-"}
            </Text>
          </VStack>
        </HStack>
      </GridItem>

      <GridItem justifySelf="end">
        <HStack
          spacing={2}
          cursor="pointer"
          _hover={{ opacity: 0.8 }}
          color="red"
          onClick={() => {
            logout();
            window.location.reload();
          }}
        >
          <Text fontWeight="semibold">Logout</Text>
          <MdLogout />
        </HStack>
      </GridItem>

      <style>
        {`
          @keyframes blink { to { opacity: 0; } }
        `}
      </style>
    </Grid>
  );
};

export default NavBar;
