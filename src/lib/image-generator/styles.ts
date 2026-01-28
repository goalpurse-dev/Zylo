
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

  Minimal: {
    label: "Minimal",
    promptHint: "minimalistic composition, clean lines, modern aesthetic",
    img: DynamicImg,
  },

   Cartoon: {
    label: "3D Cartoon",
    promptHint: "smooth 3D cartoon style, soft lighting, rounded shapes",
    img: Cartoon,
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

  Lego: {
    label: "Lego",
    promptHint: "LEGO-style build, plastic bricks, toy-like proportions",
    img: Lego,
  },

  Lowpoly: {
    label: "Lowpoly",
    promptHint: "low-poly 3D style, simple geometry, flat shading",
    img: Lowpoly,
  },

  Noir: {
    label: "Noir",
    promptHint: "film noir style, dramatic lighting, deep shadows, monochrome",
    img: Noir,
  },
} as const;

export type ImageStyleKey = keyof typeof IMAGE_STYLES;
