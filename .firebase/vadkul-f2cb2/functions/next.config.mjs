// next.config.mjs
var nextConfig = {
  reactStrictMode: false,
  // Sometimes helpful to disable for map/ref issues dev mode
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
