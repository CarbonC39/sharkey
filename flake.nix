{
  description = "Sharkey development and backend test environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forEachSystem = f:
        builtins.listToAttrs (map (system: {
          name = system;
          value = f system;
        }) systems);
    in {
      devShells = forEachSystem (system:
        let
          pkgs = import nixpkgs { inherit system; };

          # Corepack resolves the exact pnpm version in package.json. This
          # wrapper keeps that behavior while using the Nix-provided Node.js.
          pnpmCorepack = pkgs.writeShellScriptBin "pnpm" ''
            exec ${pkgs.corepack}/bin/corepack pnpm "$@"
          '';
          testServices = pkgs.writeShellScriptBin "sharkey-nix-test" ''
            set -e
            repo="''${NIX_SHARKEY_REPO_ROOT:-$PWD}"
            exec "$repo/scripts/nix-test-services.sh" "$@"
          '';
        in {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.corepack
              pnpmCorepack
              testServices
              pkgs.git
              pkgs.gnumake
              pkgs.pkg-config
              pkgs.gcc
              pkgs.python3
              pkgs.postgresql_17
              pkgs.redis
              pkgs.util-linux
              pkgs.libuuid
              pkgs.re2
              pkgs.openssl
              pkgs.ffmpeg
              pkgs.cairo
              pkgs.pango
              pkgs.libpng
              pkgs.libjpeg
              pkgs.giflib
              pkgs.librsvg
            ];

            shellHook = ''
              export NIX_SHARKEY_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
              if [ "$(uname -s)" = Linux ]; then
                export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [ pkgs.libuuid ]}:''${LD_LIBRARY_PATH:-}"
              fi
              echo "Sharkey Nix shell: Node $(node --version), pnpm $(pnpm --version)"
              echo "Backend services: sharkey-nix-test start|stop|status"
            '';
          };
        });
    };
}
