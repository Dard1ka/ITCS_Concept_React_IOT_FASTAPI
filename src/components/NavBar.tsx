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
      px={{ base: 3, sm: 4, md: "14px" }}
      py={{ base: 3, sm: 3, md: "10px" }}
      minH={{ base: "76px", md: "100px" }}
      w="100%"
      maxW="100%"
      overflowX="hidden"
      templateColumns="auto 1fr"
      templateRows="auto auto"
      columnGap={{ base: 2, sm: 3, md: 4 }}
      rowGap={{ base: 1, md: 0 }}
      alignItems="center"
    >
      <GridItem rowSpan={2} alignSelf="center" minW={0}>
        <Text
          fontWeight="bold"
          fontSize={{ base: "lg", sm: "xl", md: "2xl" }}
          lineHeight="1"
          whiteSpace="nowrap"
        >
          SIGMA
        </Text>
      </GridItem>

      <GridItem justifySelf="end" minW={0}>
        <HStack
          spacing={{ base: 1.5, sm: 2.5, md: 4 }}
          justify="flex-end"
          align="center"
          wrap="wrap"
          maxW="100%"
        >
          <Box
            flex="0 0 auto"
            transform={{
              base: "scale(0.8)",
              sm: "scale(0.85)",
              md: "scale(1)",
            }}
          >
            <ColorModeSwitch />
          </Box>

          <Box
            fontWeight="semibold"
            fontSize={{
              base: "xs",
              sm: "sm",
              md: "lg",
            }}
            color={accent}
            w={{ base: "90px", sm: "115px", md: "120px" }}
            ml={{ base: 1, sm: 2, md: 0 }}
            flex="0 0 auto"
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

          <VStack
            spacing={0}
            align="flex-end"
            minW={0}
            maxW={{ base: "160px", sm: "220px", md: "260px" }}
            flex="0 1 auto"
          >
            <Text
              fontWeight="semibold"
              fontSize={{ base: "sm", sm: "sm", md: "md" }}
              noOfLines={1}
              maxW="100%"
            >
              {user ? user.name : "Guest"}
            </Text>

            <Text
              fontSize={{ base: "xs", sm: "xs", md: "sm" }}
              opacity={0.75}
              noOfLines={1}
              maxW="100%"
            >
              {user ? user.email : "-"}
            </Text>
          </VStack>
        </HStack>
      </GridItem>

      <GridItem justifySelf="end" minW={0}>
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
          <Text
            fontWeight="semibold"
            fontSize={{ base: "sm", sm: "sm", md: "md" }}
            whiteSpace="nowrap"
          >
            Logout
          </Text>
          <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            fontSize={{ base: "16px", md: "18px" }}
            lineHeight="1"
          >
            <MdLogout />
          </Box>
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
