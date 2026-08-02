export const typography = {
    // San Francisco font family (iOS default) - adapted for web
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',

    // Font sizes following iOS guidelines (px)
    fontSize: {
        caption: 11,
        footnote: 13,
        subheadline: 15,
        callout: 16,
        body: 17,
        headline: 17,
        title3: 20,
        title2: 22,
        title1: 28,
        largeTitle: 34,
    },

    // Font weights
    fontWeight: {
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    },

    // Line heights
    lineHeight: {
        tight: 1.2,
        normal: 1.4,
        relaxed: 1.6,
    },
} as const;

// Spacing scale (px)
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
} as const;

// Border radius scale (px)
export const borderRadius = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    '3xl': 24,
    full: 9999,
} as const;

// Shadows for elevation
export const shadows = {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    glow: '0 0 20px rgba(0, 217, 255, 0.3)',
    glowPurple: '0 0 20px rgba(168, 85, 247, 0.3)',
} as const;
