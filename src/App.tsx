import { Grid, GridItem, useColorModeValue } from "@chakra-ui/react";
import NavBar from "./components/NavBar";
import { useState, useEffect } from "react";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import MainPage from "./components/MainPage";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("loggedIn");
    setLoggedIn(saved === "true");
  }, []);

  if (!loggedIn) {
    if (registerMode)
      return (
        <RegisterPage
          onRegistered={() => setLoggedIn(true)}
          goLogin={() => setRegisterMode(false)}
        />
      );

    return (
      <LoginPage
        onLogin={() => setLoggedIn(true)}
        goRegister={() => setRegisterMode(true)}
      />
    );
  }

  const navBg = useColorModeValue("white", "#0a1b2e");
  const navText = useColorModeValue("black", "white");

  const mainBg = useColorModeValue("gray.100", "#091727ff");
  const mainText = useColorModeValue("black", "whiteAlpha.900");

  return (
    <Grid
      minH="100vh"
      overflowX="hidden"
      templateAreas={`
        "nav"
        "main"
      `}
      templateColumns="1fr"
      templateRows="auto 1fr"
    >
      <GridItem
        area="nav"
        bg={navBg}
        color={navText}
        display="flex"
        alignItems="center"
        px={4}
      >
        <NavBar />
      </GridItem>

      <GridItem area="main" bg={mainBg} color={mainText} p={0}>
        <MainPage />
      </GridItem>
    </Grid>
  );
}

export default App;
