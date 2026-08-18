# Multi-stage build producing a distroless image holding one static binary.
#
# The result is a few megabytes with no shell and no package manager. That is
# not only about size: an image with no shell gives an attacker who achieves
# code execution nothing to pivot with.

FROM golang:1.26-alpine AS build

WORKDIR /src

# Copy the manifests alone first. Docker caches this layer on their checksum,
# so an ordinary source change does not re-download the whole module graph.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev

# CGO_ENABLED=0 produces a static binary, which is what allows a distroless
# final stage with no libc. -trimpath strips local paths from the binary so it
# does not leak the build machine's directory layout.
RUN CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w -X github.com/mushaidul/truth-be-told/backend/cmd.Version=${VERSION}" \
      -o /out/main .

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/main /main

# Run unprivileged. The distroless nonroot tag provides uid 65532.
USER nonroot:nonroot

EXPOSE 8080

# No .env is copied in. Configuration comes from the environment, which is what
# lets the same image run in every environment unchanged.
ENTRYPOINT ["/main"]
