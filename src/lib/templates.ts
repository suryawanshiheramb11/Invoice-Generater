import type { TemplateId } from "@/types/invoice";

export interface TemplateStyle {
  id: TemplateId;
  name: string;
  description: string;
  defaultAccent: string;
  fontFamily: string;
  headerLayout: "split" | "banner" | "stacked";
  tableStyle: "boxed" | "lined" | "minimal" | "zebra";
  showAccentBar: boolean;
  uppercaseHeadings: boolean;
}

export const TEMPLATES: Record<TemplateId, TemplateStyle> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Traditional business invoice",
    defaultAccent: "#1f2937",
    fontFamily: "Georgia, 'Times New Roman', serif",
    headerLayout: "split",
    tableStyle: "lined",
    showAccentBar: false,
    uppercaseHeadings: true,
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Clean contemporary design",
    defaultAccent: "#00A97C",
    fontFamily: "var(--font-dm-sans), sans-serif",
    headerLayout: "split",
    tableStyle: "zebra",
    showAccentBar: true,
    uppercaseHeadings: false,
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Simple black-and-white professional design",
    defaultAccent: "#111111",
    fontFamily: "var(--font-dm-sans), sans-serif",
    headerLayout: "stacked",
    tableStyle: "minimal",
    showAccentBar: false,
    uppercaseHeadings: false,
  },
  business: {
    id: "business",
    name: "Business",
    description: "Corporate-style layout",
    defaultAccent: "#0f766e",
    fontFamily: "var(--font-dm-sans), sans-serif",
    headerLayout: "banner",
    tableStyle: "boxed",
    showAccentBar: true,
    uppercaseHeadings: true,
  },
  gst: {
    id: "gst",
    name: "GST",
    description: "Designed specifically for Indian GST invoices",
    defaultAccent: "#b45309",
    fontFamily: "var(--font-dm-sans), sans-serif",
    headerLayout: "banner",
    tableStyle: "boxed",
    showAccentBar: true,
    uppercaseHeadings: true,
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);
