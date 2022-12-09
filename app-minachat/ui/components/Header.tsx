import { Box, Container, Text, Group } from "@mantine/core";
import ThemeToggleButton from "./ThemeToggleButton";
import Link from "next/link";
import { FC } from "react";

const Header: FC = () => {
  return (
    <Box component="header" py="md" sx={{ textAlign: "center" }}>
      <Container>
        <Group>
          <Text sx={{ fontSize: "1.5em", fontWeight: 800 }} inline>
            <Link href="/">MinaChat</Link>
          </Text>

          {/* pushes the succeeding contents to the right */}
          <span style={{ flexGrow: 1 }} />
          <ThemeToggleButton />
        </Group>
      </Container>
    </Box>
  );
};

export default Header;
