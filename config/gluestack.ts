import { createConfig } from "@gluestack-ui/themed";

export const gluestackConfig = createConfig({
  aliases: {
    bg: "backgroundColor",
    p: "padding",
    px: "paddingHorizontal",
    py: "paddingVertical",
    m: "margin",
    mx: "marginHorizontal",
    my: "marginVertical",
    rounded: "borderRadius",
  },
  tokens: {
    colors: {
      // Brand — primary green
      brandLight:   "#edfaf4",
      brand50:      "#d0f3e3",
      brand100:     "#a4e8cb",
      brand200:     "#6dd6ab",
      brand300:     "#38bc87",
      brand400:     "#1a9e6e",
      brand500:     "#117f58",   // primary CTA
      brand600:     "#0d6346",
      brand700:     "#0b4f38",
      brand800:     "#083d2b",

      // Surfaces (dark-first design)
      surface0:     "#0f0f0f",   // page background
      surface1:     "#1a1a1a",   // card background
      surface2:     "#222222",   // input background
      surface3:     "#2e2e2e",   // border / divider

      // Text
      textPrimary:  "#f5f5f5",
      textSecondary:"#a1a1aa",
      textMuted:    "#52525b",

      // Goal colours
      bulkPrimary:  "#f59e0b",
      bulkLight:    "#fef3c7",
      cutPrimary:   "#ef4444",
      cutLight:     "#fee2e2",
      maintPrimary: "#3b82f6",
      maintLight:   "#dbeafe",

      // Macro colours
      protein:      "#a78bfa",   // purple
      carbs:        "#fb923c",   // orange
      fat:          "#facc15",   // yellow

      // Semantic
      success:      "#22c55e",
      warning:      "#f59e0b",
      error:        "#ef4444",
      info:         "#3b82f6",
    },
    space: {
      "0":    0,
      "1":    4,
      "2":    8,
      "3":    12,
      "4":    16,
      "5":    20,
      "6":    24,
      "8":    32,
      "10":   40,
      "12":   48,
      "16":   64,
    },
    radii: {
      none: 0,
      sm:   6,
      md:   10,
      lg:   14,
      xl:   20,
      "2xl":28,
      full: 9999,
    },
    fontSizes: {
      xs:   11,
      sm:   13,
      md:   15,
      lg:   17,
      xl:   20,
      "2xl":24,
      "3xl":30,
      "4xl":36,
    },
    fontWeights: {
      normal:   "400",
      medium:   "500",
      semibold: "600",
      bold:     "700",
    },
    lineHeights: {
      tight:  1.2,
      normal: 1.5,
      relaxed:1.75,
    },
  },
  componentTheme: {},
});

export type AppConfig = typeof gluestackConfig;
