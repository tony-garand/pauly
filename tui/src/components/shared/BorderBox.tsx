import React from "react";
import { Box, Text } from "ink";

interface BorderBoxProps {
  title?: string;
  children: React.ReactNode;
  width?: number | string;
  flexGrow?: number;
}

export function BorderBox({ title, children, width, flexGrow }: BorderBoxProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={width as number | undefined}
      flexGrow={flexGrow}
    >
      {title && (
        <Text bold color="cyan">
          {title}
        </Text>
      )}
      {children}
    </Box>
  );
}
