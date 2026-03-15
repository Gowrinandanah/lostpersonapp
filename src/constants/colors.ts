export const Colors = {
  light: {
    primary:       '#FF6B6B',
    secondary:     '#4ECDC4',
    accent:        '#FFE66D',
    background:    '#FFFFFF',
    surface:       '#F7F9FC',
    text:          '#2C3E50',
    textSecondary: '#7F8C8D',
    border:        '#E1E8ED',
    error:         '#E74C3C',
    success:       '#2ECC71',
    warning:       '#F39C12',
    info:          '#3498DB',
    card:          '#FFFFFF',
    shadow:        '#000000',
  },
  dark: {
    primary:       '#FF8A8A',
    secondary:     '#6FD9D1',
    accent:        '#FFED8F',
    background:    '#1A1E24',
    surface:       '#2C3E50',
    text:          '#ECF0F1',
    textSecondary: '#BDC3C7',
    border:        '#34495E',
    error:         '#E74C3C',
    success:       '#2ECC71',
    warning:       '#F39C12',
    info:          '#3498DB',
    card:          '#2C3E50',
    shadow:        '#000000',
  },
};

// ColorScheme is the shape of a theme object — both light and dark satisfy it
// because the values are typed as `string`, not as literal hex types.
export type ColorScheme = typeof Colors.light;