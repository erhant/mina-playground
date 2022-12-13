import { Container } from "@mantine/core";
import type { FC, ReactNode } from "react";
import Header from "./Header";
import styles from "../styles/layout.module.scss";

const Layout: FC<{
  children: ReactNode;
}> = ({ children }) => {
  return (
    <div className={styles["layout"]}>
      <Header />
      <Container>{children}</Container>
    </div>
  );
};

export default Layout;
