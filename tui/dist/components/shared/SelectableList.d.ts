import React from "react";
interface SelectableListProps<T> {
    items: T[];
    renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
    onSelect?: (item: T, index: number) => void;
    onHighlight?: (item: T, index: number) => void;
    maxVisible?: number;
    active?: boolean;
}
export declare function SelectableList<T>({ items, renderItem, onSelect, onHighlight, maxVisible, active, }: SelectableListProps<T>): import("react/jsx-runtime").JSX.Element;
export {};
