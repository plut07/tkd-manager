/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdf.js can fall back to node-canvas when it thinks it is on a server.
    // The template designer only ever renders in the browser, so tell webpack
    // there is no canvas package to find rather than letting the build fail
    // looking for one.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
