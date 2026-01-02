import { HStack, Switch, useColorMode, Icon } from "@chakra-ui/react";
import { FaRegMoon } from "react-icons/fa";

const ColorModeSwitch = () => {
  const { toggleColorMode, colorMode } = useColorMode();

  return (
    <HStack spacing={2} marginRight={-6}>
      <Icon as={FaRegMoon} />
      <Switch isChecked={colorMode === "dark"} onChange={toggleColorMode} />
    </HStack>
  );
};

export default ColorModeSwitch;
