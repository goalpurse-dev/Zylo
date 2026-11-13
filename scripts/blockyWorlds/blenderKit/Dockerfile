# Blender kit engine (phase 1): RunPod serverless GPU worker that renders a Blender story kit video with the kit's own
# tools (EEVEE, as the kit's rbx/core.py setup_render). The build context comes from buildContext.mjs (outside the repo:
# the kit's files are never committed). No secrets: nothing here reads a key; the handler gets signed URLs per job.
FROM debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NVIDIA_DRIVER_CAPABILITIES=all \
    NVIDIA_VISIBLE_DEVICES=all \
    PYTHONDONTWRITEBYTECODE=1

# Blender's runtime libraries (X11 / Wayland / EGL / Vulkan loaders), Xvfb + VirtualGL for the GLX fallback,
# ffmpeg (with libass for the kit's captions), python3 + numpy + Pillow for the kit's finish/mix tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget xz-utils ffmpeg python3 python3-pip python3-numpy python3-pil \
    libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libxext6 libxkbcommon0 libxkbcommon-x11-0 libsm6 libice6 libxcursor1 \
    libxinerama1 libxrandr2 libgl1 libegl1 libgles2 libglvnd0 libglx0 libopengl0 libvulkan1 libwayland-client0 libwayland-cursor0 \
    libwayland-egl1 libdecor-0-0 libdbus-1-3 libgomp1 libglu1-mesa xvfb xauth fontconfig fonts-dejavu-core util-linux \
 && wget -q https://github.com/VirtualGL/virtualgl/releases/download/3.1.5/virtualgl_3.1.5_amd64.deb -O /tmp/vgl.deb \
 && apt-get install -y --no-install-recommends /tmp/vgl.deb \
 && (apt-get install -y --no-install-recommends setpriv || true) \
 && command -v setpriv && command -v unshare && command -v Xvfb && test -x /opt/VirtualGL/bin/vglrun \
 && rm -f /tmp/vgl.deb && rm -rf /var/lib/apt/lists/*

# Blender 5.2.4 (the kit is built and tested on 5.2), checksum from download.blender.org
RUN wget -q https://download.blender.org/release/Blender5.2/blender-5.2.4-linux-x64.tar.xz -O /tmp/blender.tar.xz \
 && echo "2fd14c50987426897ba60237ee996edf2b4151f4b1a72a460ca20be58c1d2d86  /tmp/blender.tar.xz" | sha256sum -c - \
 && mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
 && rm -f /tmp/blender.tar.xz && ln -s /opt/blender/blender /usr/local/bin/blender

# the NVIDIA vendor files: the container gets the driver's libraries (NVIDIA_DRIVER_CAPABILITIES=all) but not these,
# and without them EGL / Vulkan fall back to software (scripts/blockyWorlds/engine/runpod/Dockerfile)
RUN mkdir -p /usr/share/glvnd/egl_vendor.d /etc/vulkan/icd.d \
 && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json \
 && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' > /etc/vulkan/icd.d/nvidia_icd.json

# caption font (OFL): Archivo Black, the free stand-in for the kit's Arial Black / Segoe UI Black
RUN mkdir -p /usr/local/share/fonts/archivo \
 && wget -q https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf -O /usr/local/share/fonts/archivo/ArchivoBlack-Regular.ttf \
 && fc-cache -f >/dev/null

RUN pip3 install --no-cache-dir --break-system-packages "runpod>=1.7,<2"

# the sandbox user: Blender and the kit's finish step run as this user (handler.py), never as root
RUN useradd --create-home --uid 1001 --shell /usr/sbin/nologin render

# the kit (read-only for the render user) + our music bed + our glue
COPY kit /app/kit
COPY music /app/music
COPY handler.py boot.py gpucheck.py netblock.py shotcheck.py /app/
RUN chmod -R a+rX,go-w /app && /opt/blender/blender -b --factory-startup --version | head -1

WORKDIR /app
CMD ["python3", "-u", "/app/handler.py"]
