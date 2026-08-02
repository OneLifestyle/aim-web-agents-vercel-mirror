export const colors = {
    // Background colors - Light/White theme
    background: '#FFFFFF',
    backgroundSecondary: '#F8F9FA',
    backgroundTertiary: '#F1F3F5',

    // Surface colors - Light surfaces
    surface: '#FFFFFF',
    surfaceHover: '#F8F9FA',
    surfaceElevated: '#FFFFFF',

    // Primary accent - Blue (from reference)
    primary: '#4A90E2',
    primaryHover: '#357ABD',
    primaryLight: '#6BA3E8',
    primaryDark: '#2E5F8F',

    // Secondary accent - Lighter blue
    secondary: '#5B9FED',
    secondaryHover: '#4A8FDD',
    accent: '#4A90E2',

    // Success/Green
    success: '#10B981',
    successLight: '#34D399',

    // Warning/Orange
    warning: '#F59E0B',
    warningLight: '#FCD34D',

    // Error/Red
    error: '#EF4444',
    errorLight: '#F87171',

    // Text colors - Dark text on light background
    text: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textMuted: '#D1D5DB',

    // Border colors
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    borderDark: '#D1D5DB',

    // Card/Panel colors
    card: '#FFFFFF',
    cardHover: '#F9FAFB',
    cardBorder: '#E5E7EB',

    // Separator
    separator: '#E5E7EB',

    // Gradients (subtle for light theme)
    gradients: {
        primary: 'linear-gradient(135deg, #4A90E2 0%, #5B9FED 100%)',
        secondary: 'linear-gradient(135deg, #5B9FED 0%, #6BA3E8 100%)',
        success: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F8F9FA 100%)',
        card: 'linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)',
    },

    // Legacy compatibility (keeping for existing components)
    secondaryBackground: '#F8F9FA',
    tertiaryBackground: '#F1F3F5',
    white: '#FFFFFF',
    black: '#000000',

    // Camera UI colors (keeping for camera features)
    cameraOverlay: 'rgba(0, 0, 0, 0.5)',
    shutterButton: '#4A90E2',
    shutterButtonPressed: '#357ABD',
    modeActive: '#4A90E2',
    modeInactive: '#9CA3AF',

    // AI Tools colors
    maskingStroke: '#4A90E2',
    maskingFill: 'rgba(74, 144, 226, 0.2)',
    creditsBadge: '#4A90E2',
} as const;
