const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: {
    hub: "./src/hub/index.tsx",
    toolbar: "./src/toolbar/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name]/[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".jsx", ".css"],
    // Ensure only one instance of React is bundled
    alias: {
      react: path.resolve("./node_modules/react"),
      "react-dom": path.resolve("./node_modules/react-dom"),
      "styled-components": path.resolve("./node_modules/styled-components"),
    },
    fallback: {
      // inkwell-md uses some node builtins in host code (not editor code), but
      // the editor itself does not – silence the warnings for browser builds.
      path: false,
      fs: false,
      child_process: false,
    },
  },
  module: {
    rules: [
      {
        // Compile TypeScript for our code AND for the inkwell-md source that
        // is referenced directly (it ships as TypeScript, not pre-built).
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            // Skip full type-checking so the inkwell-md files (which have
            // their own dev-only types) don't cause build failures.
            transpileOnly: true,
          },
        },
        // Include node_modules/inkwell-md so webpack compiles its TS sources.
        exclude: /node_modules\/(?!inkwell-md)/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|svg|jpg|gif|woff2?)$/,
        type: "asset/resource",
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/hub/index.html",
      filename: "hub/index.html",
      chunks: ["hub"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/toolbar/index.html",
      filename: "toolbar/index.html",
      chunks: ["toolbar"],
    }),
  ],
};
