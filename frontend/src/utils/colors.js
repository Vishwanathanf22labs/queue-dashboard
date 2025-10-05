export const colors = {
  primary: {
    light: "bg-blue-50 text-blue-700 border-blue-200",
    default: "bg-blue-500 text-white border-blue-500",
    dark: "bg-blue-700 text-white border-blue-700",
    hover: "hover:bg-blue-600",
    disabled: "bg-gray-300 text-gray-500 cursor-not-allowed",
  },
  success: {
    light: "bg-green-50 text-green-700 border-green-200",
    default: "bg-green-500 text-white border-green-500",
    dark: "bg-green-600 text-white border-green-600",
    hover: "hover:bg-green-600",
  },
  warning: {
    light: "bg-yellow-50 text-yellow-700 border-yellow-200",
    default: "bg-yellow-500 text-white border-yellow-500",
    dark: "bg-yellow-600 text-white border-yellow-600",
    hover: "hover:bg-yellow-600",
  },
  error: {
    light: "bg-red-50 text-red-700 border-red-200",
    default: "bg-red-500 text-white border-red-500",
    dark: "bg-red-600 text-white border-red-600",
    hover: "hover:bg-red-600",
  },
  info: {
    light: "bg-blue-50 text-blue-700 border-blue-200",
    default: "bg-blue-500 text-white border-blue-500",
    dark: "bg-blue-600 text-white border-blue-600",
    hover: "hover:bg-blue-600",
  },
  secondary: {
    light: "bg-gray-50 text-gray-700 border-gray-200",
    default: "bg-gray-500 text-white border-gray-500",
    dark: "bg-gray-700 text-white border-gray-700",
    hover: "hover:bg-gray-600",
  },
  outline: {
    light: "bg-white text-gray-700 border-gray-300",
    default: "bg-white text-gray-700 border-gray-300",
    dark: "bg-gray-50 text-gray-800 border-gray-400",
    hover: "hover:bg-gray-50",
  },
  gray: {
    light: "bg-gray-100 text-gray-700 border-gray-300",
    default: "bg-gray-500 text-white border-gray-500",
    dark: "bg-gray-700 text-white border-gray-700",
    hover: "hover:bg-gray-600",
  },
  cooldownWL: {
    light: "bg-indigo-100 text-indigo-800 border-indigo-200",
    default: "bg-indigo-500 text-white border-indigo-500",
    dark: "bg-indigo-600 text-white border-indigo-600",
    hover: "hover:bg-indigo-600",
  },
  cooldownNWL: {
    light: "bg-orange-100 text-orange-800 border-orange-200",
    default: "bg-orange-500 text-white border-orange-500",
    dark: "bg-orange-600 text-white border-orange-600",
    hover: "hover:bg-orange-600",
  },
};

Object.keys(colors).forEach((key) => {
  if (!colors[key].light) {
    console.warn(`Color ${key} is missing 'light' property`);
    colors[key].light = colors.gray.light;
  }
});

export const statusColors = {
  Active: colors.success,
  Inactive: colors.gray,
  Incomplete: colors.warning,
  pending: colors.warning,
  failed: colors.error,
  processing: colors.primary,
  completed: colors.success,

  info: colors.info,
  success: colors.success,
  error: colors.error,
  warning: colors.warning,

  primary: colors.primary,
  secondary: colors.secondary,
  outline: colors.outline,

  waiting: colors.warning,
  active: colors.success,
  delayed: colors.warning,
  gray: colors.gray,
  cooldownWL: colors.cooldownWL,
  cooldownNWL: colors.cooldownNWL,
};

Object.keys(statusColors).forEach((key) => {
  if (!statusColors[key].light) {
    console.warn(`Status color ${key} is missing 'light' property`);
    statusColors[key].light = colors.gray.light;
  }
});

export const getVariantClasses = (variant) => {
  try {
    const variantColor = statusColors[variant];
    if (variantColor && variantColor.light) {
      return variantColor.light;
    }
    return statusColors.gray.light;
  } catch (error) {
    console.error("Error in Badge component:", error);
    return statusColors.gray.light;
  }
};
