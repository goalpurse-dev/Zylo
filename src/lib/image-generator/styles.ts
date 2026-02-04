
import Dynamic from "../../assets/styles/dynamic.png";
import DynamicImg from "../../assets/logos/hidream.png";
import Cinematic from "../../assets/styles/cinematic.png";

import Anime from "../../assets/thumbs/anime.jpg";
import Clay from "../../assets/thumbs/clay.jpg";
import Comic from "../../assets/thumbs/comic.png";
import Disney from "../../assets/thumbs/disney.jpg";
import Lego from "../../assets/thumbs/lego.jpg";
import Lowpoly from "../../assets/thumbs/lowpoly.jpg";
import Noir from "../../assets/thumbs/noir.jpg";
import Cartoon from "../../assets/thumbs/3dcartoon.png";
import Minimal from "../../assets/thumbs/minimal.png";
import Minecraft from "../../assets/thumbs/minecraft.png";
import Ghibli from "../../assets/thumbs/ghibli.png";
import Cyberpunk from "../../assets/thumbs/cyberpunk.png";
import Pixelart from "../../assets/thumbs/pixelart.png";
import Realistic from "../../assets/thumbs/realistic.png";



export const IMAGE_STYLES = {
  Cinematic: {
    label: "Cinematic",
    promptHint: "cinematic lighting, dramatic composition, ultra-realistic",
    img: Cinematic,
  },

  Dynamic: {
    label: "Dynamic",
    promptHint: "dynamic motion, energetic composition, sharp focus",
    img: Dynamic,
  },

   Cartoon: {
    label: "3D Cartoon",
    promptHint: "smooth 3D cartoon style, soft lighting, rounded shapes",
    img: Cartoon,
  },

    Minecraft: {
    label: "Minecraft",
    promptHint: "Minecraft-style blocky, pixelated, low-poly aesthetic",
    img: Minecraft,
  },

  
   Realistic: {
    label: "Realistic",
    promptHint: "realistic style, high detail, photorealistic rendering",
    img: Realistic,
  },


  Anime: {
    label: "Anime",
    promptHint: "anime illustration style, expressive features, clean linework",
    img: Anime,
  },

  Clay: {
    label: "Clay",
    promptHint: "claymation style, handmade clay texture, soft studio lighting",
    img: Clay,
  },

  Comic: {
    label: "Comic",
    promptHint: "comic book style, bold outlines, high contrast colors",
    img: Comic,
  },

  Disney: {
    label: "Disney",
    promptHint: "Disney-inspired animation style, soft shading, friendly proportions",
    img: Disney,
  },

    Ghibli: {
    label: "Ghibli",
    promptHint: "Studio Ghibli-style animation, soft shading, whimsical aesthetic",
    img: Ghibli,
  },

  Lego: {
    label: "Lego",
    promptHint: "LEGO-style build, plastic bricks, toy-like proportions",
    img: Lego,
  },

   Cyberpunk: {
    label: "Cyberpunk",
    promptHint: "cyberpunk aesthetic, neon lighting, futuristic elements",
    img: Cyberpunk,
  },

  Lowpoly: {
    label: "Lowpoly",
    promptHint: "low-poly 3D style, simple geometry, flat shading",
    img: Lowpoly,
  },

   PixelArt: {
    label: "Pixel Art",
    promptHint: "pixel art style, retro 8-bit aesthetic, low resolution",
    img: Pixelart,
  },


  Noir: {
    label: "Noir",
    promptHint: "film noir style, dramatic lighting, deep shadows, monochrome",
    img: Noir,
  },
} as const;

export type ImageStyleKey = keyof typeof IMAGE_STYLES;
