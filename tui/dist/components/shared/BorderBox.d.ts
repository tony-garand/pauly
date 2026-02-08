import React from "react";
interface BorderBoxProps {
    title?: string;
    children: React.ReactNode;
    width?: number | string;
    flexGrow?: number;
}
export declare function BorderBox({ title, children, width, flexGrow }: BorderBoxProps): import("react/jsx-runtime").JSX.Element;
export {};
