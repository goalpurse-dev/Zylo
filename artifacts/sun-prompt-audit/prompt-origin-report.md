# Prompt origin report

## Evidence boundary

Actual provider history comes only from linked jobs. Current compiler output is also shown separately and may differ from a persisted job prompt if code changed after submission.

## Layer counts

- Narration/VisualPlan beats: 214
- Current compiled raster prompts: 153
- GraphicSpecs: 27
- Persisted render plans: 214
- Persisted scene attempts: 558
- Actual provider payloads: 49

## Specific comparisons

- Shots 1–6 full-prompt similarities: 1/2=0.949, 1/3=1.000, 1/4=0.949, 1/5=0.944, 1/6=1.000, 2/3=0.949, 2/4=1.000, 2/5=0.949, 2/6=0.949, 3/4=0.949, 3/5=0.944, 3/6=1.000, 4/5=0.949, 4/6=0.949, 5/6=0.944.
- Shot 16 vs 21 full-prompt similarity: 0.932.
- Chapter 5: 66 shots; 42 GENERATE, 10 REUSE, 14 PROGRAMMATIC_GRAPHIC. The 42 raster prompts collapse to only 5 unique prompts; the largest exact Chapter 5 family contains 15 shots. No Chapter 5 provider submissions existed at audit time.

## Search-term origins

```json
{
  "499": [
    {
      "shotNumber": 9,
      "shotId": "vb2_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 10,
      "shotId": "vb2_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 11,
      "shotId": "vb2_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 12,
      "shotId": "vb2_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 13,
      "shotId": "vb2_shot_5",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 14,
      "shotId": "vb2_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 15,
      "shotId": "vb_ch2_01_shot_1",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 16,
      "shotId": "vb_ch2_01_shot_2",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 17,
      "shotId": "vb_ch2_01_shot_3",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 18,
      "shotId": "vb_ch2_01_shot_4",
      "layers": [
        "narration",
        "visualPlan",
        "graphicSpec"
      ]
    },
    {
      "shotNumber": 19,
      "shotId": "vb_ch2_01_shot_5",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 20,
      "shotId": "vb_ch2_01_shot_6",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 21,
      "shotId": "vb_ch2_01_shot_7",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 44,
      "shotId": "vb_ch4_01_shot_1",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 45,
      "shotId": "vb_ch4_01_shot_2",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 46,
      "shotId": "vb_ch4_01_shot_3",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 47,
      "shotId": "vb_ch4_01_shot_4",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 48,
      "shotId": "vb_ch4_01_shot_5",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 49,
      "shotId": "vb_ch4_01_shot_6",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 50,
      "shotId": "vb_ch4_01_shot_7",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 51,
      "shotId": "vb_ch4_01_shot_8",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 52,
      "shotId": "vb_ch4_02_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 53,
      "shotId": "vb_ch4_02_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 54,
      "shotId": "vb_ch4_02_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 55,
      "shotId": "vb_ch4_02_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 56,
      "shotId": "vb_ch4_02_shot_5",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 57,
      "shotId": "vb_ch4_02_shot_6",
      "layers": [
        "visualPlan"
      ]
    }
  ],
  "feel it": [
    {
      "shotNumber": 1,
      "shotId": "vb1_shot_1",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 2,
      "shotId": "vb1_shot_2",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 3,
      "shotId": "vb1_shot_3",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 4,
      "shotId": "vb1_shot_4",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 5,
      "shotId": "vb1_shot_5",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 6,
      "shotId": "vb1_shot_6",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 7,
      "shotId": "vb1_shot_7",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    }
  ],
  "freeze": [
    {
      "shotNumber": 1,
      "shotId": "vb1_shot_1",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 2,
      "shotId": "vb1_shot_2",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 3,
      "shotId": "vb1_shot_3",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 4,
      "shotId": "vb1_shot_4",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 5,
      "shotId": "vb1_shot_5",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 6,
      "shotId": "vb1_shot_6",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 7,
      "shotId": "vb1_shot_7",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 8,
      "shotId": "vb1_shot_8",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 9,
      "shotId": "vb2_shot_1",
      "layers": [
        "narration"
      ]
    },
    {
      "shotNumber": 10,
      "shotId": "vb2_shot_2",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 11,
      "shotId": "vb2_shot_3",
      "layers": [
        "narration"
      ]
    },
    {
      "shotNumber": 12,
      "shotId": "vb2_shot_4",
      "layers": [
        "narration"
      ]
    },
    {
      "shotNumber": 13,
      "shotId": "vb2_shot_5",
      "layers": [
        "narration"
      ]
    },
    {
      "shotNumber": 14,
      "shotId": "vb2_shot_6",
      "layers": [
        "narration"
      ]
    },
    {
      "shotNumber": 197,
      "shotId": "vb_ch7_s12_01_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 198,
      "shotId": "vb_ch7_s12_01_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 199,
      "shotId": "vb_ch7_s12_01_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 200,
      "shotId": "vb_ch7_s12_01_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 201,
      "shotId": "vb_ch7_s12_01_shot_5",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 202,
      "shotId": "vb_ch7_s12_01_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 203,
      "shotId": "vb_ch7_s12_01_shot_7",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 204,
      "shotId": "vb_ch7_s12_01_shot_8",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 205,
      "shotId": "vb_ch7_s12_01_shot_9",
      "layers": [
        "visualPlan"
      ]
    }
  ],
  "fly away": [
    {
      "shotNumber": 1,
      "shotId": "vb1_shot_1",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 2,
      "shotId": "vb1_shot_2",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 3,
      "shotId": "vb1_shot_3",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 4,
      "shotId": "vb1_shot_4",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 5,
      "shotId": "vb1_shot_5",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 6,
      "shotId": "vb1_shot_6",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 7,
      "shotId": "vb1_shot_7",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    }
  ],
  "15,000": [
    {
      "shotNumber": 44,
      "shotId": "vb_ch4_01_shot_1",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 45,
      "shotId": "vb_ch4_01_shot_2",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 46,
      "shotId": "vb_ch4_01_shot_3",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 47,
      "shotId": "vb_ch4_01_shot_4",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 48,
      "shotId": "vb_ch4_01_shot_5",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 49,
      "shotId": "vb_ch4_01_shot_6",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 50,
      "shotId": "vb_ch4_01_shot_7",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 51,
      "shotId": "vb_ch4_01_shot_8",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    }
  ],
  "15,00": [
    {
      "shotNumber": 44,
      "shotId": "vb_ch4_01_shot_1",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 45,
      "shotId": "vb_ch4_01_shot_2",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 46,
      "shotId": "vb_ch4_01_shot_3",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 47,
      "shotId": "vb_ch4_01_shot_4",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 48,
      "shotId": "vb_ch4_01_shot_5",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 49,
      "shotId": "vb_ch4_01_shot_6",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 50,
      "shotId": "vb_ch4_01_shot_7",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 51,
      "shotId": "vb_ch4_01_shot_8",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    }
  ],
  "29.8": [
    {
      "shotNumber": 44,
      "shotId": "vb_ch4_01_shot_1",
      "layers": [
        "narration",
        "graphicSpec"
      ]
    },
    {
      "shotNumber": 45,
      "shotId": "vb_ch4_01_shot_2",
      "layers": [
        "narration",
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 46,
      "shotId": "vb_ch4_01_shot_3",
      "layers": [
        "narration",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 47,
      "shotId": "vb_ch4_01_shot_4",
      "layers": [
        "narration",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 48,
      "shotId": "vb_ch4_01_shot_5",
      "layers": [
        "narration",
        "graphicSpec"
      ]
    },
    {
      "shotNumber": 49,
      "shotId": "vb_ch4_01_shot_6",
      "layers": [
        "narration",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 50,
      "shotId": "vb_ch4_01_shot_7",
      "layers": [
        "narration",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 51,
      "shotId": "vb_ch4_01_shot_8",
      "layers": [
        "narration",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    }
  ],
  "8:19": [
    {
      "shotNumber": 10,
      "shotId": "vb2_shot_2",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 11,
      "shotId": "vb2_shot_3",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 12,
      "shotId": "vb2_shot_4",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 15,
      "shotId": "vb_ch2_01_shot_1",
      "layers": [
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 16,
      "shotId": "vb_ch2_01_shot_2",
      "layers": [
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 17,
      "shotId": "vb_ch2_01_shot_3",
      "layers": [
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 18,
      "shotId": "vb_ch2_01_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 19,
      "shotId": "vb_ch2_01_shot_5",
      "layers": [
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 20,
      "shotId": "vb_ch2_01_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 21,
      "shotId": "vb_ch2_01_shot_7",
      "layers": [
        "visualPlan",
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    }
  ],
  "instant full darkness": [
    {
      "shotNumber": 29,
      "shotId": "vb_ch3_02_shot_1",
      "layers": [
        "graphicSpec"
      ]
    },
    {
      "shotNumber": 30,
      "shotId": "vb_ch3_02_shot_2",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 31,
      "shotId": "vb_ch3_02_shot_3",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 32,
      "shotId": "vb_ch3_02_shot_4",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 33,
      "shotId": "vb_ch3_02_shot_5",
      "layers": [
        "graphicSpec"
      ]
    },
    {
      "shotNumber": 34,
      "shotId": "vb_ch3_02_shot_6",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    },
    {
      "shotNumber": 35,
      "shotId": "vb_ch3_02_shot_7",
      "layers": [
        "compiledScenePrompt",
        "actualProviderPayload"
      ]
    }
  ],
  "X": [],
  "cross": [
    {
      "shotNumber": 58,
      "shotId": "vb_ch5_01_shot_1",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 59,
      "shotId": "vb_ch5_02_shot_1",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 60,
      "shotId": "vb_ch5_03_shot_1",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 61,
      "shotId": "vb_ch5_04_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 62,
      "shotId": "vb_ch5_05_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 63,
      "shotId": "vb_ch5_06_shot_1",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 64,
      "shotId": "vb_ch5_01_shot_2",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 65,
      "shotId": "vb_ch5_02_shot_2",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 66,
      "shotId": "vb_ch5_03_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 67,
      "shotId": "vb_ch5_04_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 68,
      "shotId": "vb_ch5_05_shot_2",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 69,
      "shotId": "vb_ch5_06_shot_2",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 70,
      "shotId": "vb_ch5_01_shot_3",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 71,
      "shotId": "vb_ch5_02_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 72,
      "shotId": "vb_ch5_03_shot_3",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 73,
      "shotId": "vb_ch5_04_shot_3",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 74,
      "shotId": "vb_ch5_05_shot_3",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 75,
      "shotId": "vb_ch5_06_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 76,
      "shotId": "vb_ch5_01_shot_4",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 77,
      "shotId": "vb_ch5_02_shot_4",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 78,
      "shotId": "vb_ch5_03_shot_4",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 79,
      "shotId": "vb_ch5_04_shot_4",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 80,
      "shotId": "vb_ch5_05_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 81,
      "shotId": "vb_ch5_06_shot_4",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 82,
      "shotId": "vb_ch5_01_shot_5",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 83,
      "shotId": "vb_ch5_02_shot_5",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 84,
      "shotId": "vb_ch5_03_shot_5",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 85,
      "shotId": "vb_ch5_04_shot_5",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 86,
      "shotId": "vb_ch5_05_shot_5",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 87,
      "shotId": "vb_ch5_06_shot_5",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 88,
      "shotId": "vb_ch5_01_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 89,
      "shotId": "vb_ch5_02_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 90,
      "shotId": "vb_ch5_03_shot_6",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 91,
      "shotId": "vb_ch5_04_shot_6",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 92,
      "shotId": "vb_ch5_05_shot_6",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 93,
      "shotId": "vb_ch5_06_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 94,
      "shotId": "vb_ch5_01_shot_7",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 95,
      "shotId": "vb_ch5_02_shot_7",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 96,
      "shotId": "vb_ch5_03_shot_7",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 97,
      "shotId": "vb_ch5_04_shot_7",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 98,
      "shotId": "vb_ch5_05_shot_7",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 99,
      "shotId": "vb_ch5_06_shot_7",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 100,
      "shotId": "vb_ch5_01_shot_8",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 101,
      "shotId": "vb_ch5_02_shot_8",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 102,
      "shotId": "vb_ch5_03_shot_8",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 103,
      "shotId": "vb_ch5_04_shot_8",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 104,
      "shotId": "vb_ch5_05_shot_8",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 105,
      "shotId": "vb_ch5_06_shot_8",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 106,
      "shotId": "vb_ch5_01_shot_9",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 107,
      "shotId": "vb_ch5_02_shot_9",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 108,
      "shotId": "vb_ch5_03_shot_9",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 109,
      "shotId": "vb_ch5_04_shot_9",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 110,
      "shotId": "vb_ch5_05_shot_9",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 111,
      "shotId": "vb_ch5_06_shot_9",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 112,
      "shotId": "vb_ch5_01_shot_10",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 113,
      "shotId": "vb_ch5_02_shot_10",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 114,
      "shotId": "vb_ch5_03_shot_10",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 115,
      "shotId": "vb_ch5_04_shot_10",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 116,
      "shotId": "vb_ch5_05_shot_10",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 117,
      "shotId": "vb_ch5_06_shot_10",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 118,
      "shotId": "vb_ch5_01_shot_11",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 119,
      "shotId": "vb_ch5_02_shot_11",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 120,
      "shotId": "vb_ch5_03_shot_11",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 121,
      "shotId": "vb_ch5_04_shot_11",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 122,
      "shotId": "vb_ch5_05_shot_11",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    },
    {
      "shotNumber": 123,
      "shotId": "vb_ch5_06_shot_11",
      "layers": [
        "visualPlan",
        "compiledScenePrompt"
      ]
    }
  ],
  "crossed out": [],
  "phone": [
    {
      "shotNumber": 44,
      "shotId": "vb_ch4_01_shot_1",
      "layers": [
        "graphicSpec"
      ]
    },
    {
      "shotNumber": 48,
      "shotId": "vb_ch4_01_shot_5",
      "layers": [
        "graphicSpec"
      ]
    }
  ],
  "mobile": [],
  "device": [
    {
      "shotNumber": 22,
      "shotId": "vb_ch3_01_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 23,
      "shotId": "vb_ch3_01_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 24,
      "shotId": "vb_ch3_01_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 25,
      "shotId": "vb_ch3_01_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 26,
      "shotId": "vb_ch3_01_shot_5",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 27,
      "shotId": "vb_ch3_01_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 28,
      "shotId": "vb_ch3_01_shot_7",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 36,
      "shotId": "vb_ch3_03_shot_1",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 37,
      "shotId": "vb_ch3_03_shot_2",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 38,
      "shotId": "vb_ch3_03_shot_3",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 39,
      "shotId": "vb_ch3_03_shot_4",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 40,
      "shotId": "vb_ch3_03_shot_5",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 41,
      "shotId": "vb_ch3_03_shot_6",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 42,
      "shotId": "vb_ch3_03_shot_7",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 43,
      "shotId": "vb_ch3_03_shot_8",
      "layers": [
        "narration",
        "visualPlan"
      ]
    },
    {
      "shotNumber": 124,
      "shotId": "vb6_1_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 128,
      "shotId": "vb6_5_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 130,
      "shotId": "vb6_1_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 134,
      "shotId": "vb6_5_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 136,
      "shotId": "vb6_1_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 140,
      "shotId": "vb6_5_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 142,
      "shotId": "vb6_1_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 146,
      "shotId": "vb6_5_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 148,
      "shotId": "vb6_1_shot_5",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 152,
      "shotId": "vb6_5_shot_5",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 154,
      "shotId": "vb6_1_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 158,
      "shotId": "vb6_5_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 160,
      "shotId": "vb6_1_shot_7",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 164,
      "shotId": "vb6_5_shot_7",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 166,
      "shotId": "vb6_1_shot_8",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 170,
      "shotId": "vb6_5_shot_8",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 172,
      "shotId": "vb6_1_shot_9",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 176,
      "shotId": "vb6_5_shot_9",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 178,
      "shotId": "vb6_1_shot_10",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 182,
      "shotId": "vb6_5_shot_10",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 184,
      "shotId": "vb6_1_shot_11",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 188,
      "shotId": "vb6_5_shot_11",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 197,
      "shotId": "vb_ch7_s12_01_shot_1",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 198,
      "shotId": "vb_ch7_s12_01_shot_2",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 199,
      "shotId": "vb_ch7_s12_01_shot_3",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 200,
      "shotId": "vb_ch7_s12_01_shot_4",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 201,
      "shotId": "vb_ch7_s12_01_shot_5",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 202,
      "shotId": "vb_ch7_s12_01_shot_6",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 203,
      "shotId": "vb_ch7_s12_01_shot_7",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 204,
      "shotId": "vb_ch7_s12_01_shot_8",
      "layers": [
        "visualPlan"
      ]
    },
    {
      "shotNumber": 205,
      "shotId": "vb_ch7_s12_01_shot_9",
      "layers": [
        "visualPlan"
      ]
    }
  ],
  "black background": [],
  "dark background": [],
  "white background": [],
  "Mars": [],
  "Viking": [],
  "Wi-Fi": [],
  "wifi": []
}
```

## Graphics evidence

- Graphic shots: 27.
- SYMBOL_NEGATION shots: 27; shots 9, 13, 18, 29, 33, 44, 48, 53, 57, 62, 66, 71, 75, 80, 84, 89, 93, 98, 102, 107, 111, 116, 120, 190, 194, 199, 203.
- Background is hardcoded at compile time as dark because `episodePreflight.ts` calls `compileGraphicSpec(..., { theme: "dark" })`.
- Red X is hardcoded in `graphicTemplates.ts`: every non-affirmed SYMBOL_NEGATION draws `drawXMark(..., p.negative, ...)`.
- Generic phone/device treatment comes from deterministic keyword inference and the SYMBOL_NEGATION icon variant pool in `graphicSpec.ts`, not a provider or another project.

Full current GraphicSpecs:
```json
[
  {
    "shotNumber": 9,
    "shotId": "vb2_shot_1",
    "graphicSpec": {
      "version": 1,
      "claimId": "s2__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s2__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "≈8 min 19 s",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 13,
    "shotId": "vb2_shot_5",
    "graphicSpec": {
      "version": 1,
      "claimId": "s2__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s2__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "≈8 min 19 s",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 18,
    "shotId": "vb_ch2_01_shot_4",
    "graphicSpec": {
      "version": 1,
      "claimId": "s3__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s3__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "≈499 s",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 29,
    "shotId": "vb_ch3_02_shot_1",
    "graphicSpec": {
      "version": 1,
      "claimId": "s5__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s5__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "INSTANT FULL DARKNESS",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 33,
    "shotId": "vb_ch3_02_shot_5",
    "graphicSpec": {
      "version": 1,
      "claimId": "s5__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s5__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "INSTANT FULL DARKNESS",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 44,
    "shotId": "vb_ch4_01_shot_1",
    "graphicSpec": {
      "version": 1,
      "claimId": "s7__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s7__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "phone",
      "label": "Earth speed ≈29.8 km/s",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 48,
    "shotId": "vb_ch4_01_shot_5",
    "graphicSpec": {
      "version": 1,
      "claimId": "s7__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s7__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "phone",
      "label": "Earth speed ≈29.8 km/s",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 53,
    "shotId": "vb_ch4_02_shot_2",
    "graphicSpec": {
      "version": 1,
      "claimId": "s8__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s8__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "A DEFINITIVE LONG-TERM",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 57,
    "shotId": "vb_ch4_02_shot_6",
    "graphicSpec": {
      "version": 1,
      "claimId": "s8__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s8__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "A DEFINITIVE LONG-TERM",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 62,
    "shotId": "vb_ch5_05_shot_1",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 66,
    "shotId": "vb_ch5_03_shot_2",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 71,
    "shotId": "vb_ch5_02_shot_3",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 75,
    "shotId": "vb_ch5_06_shot_3",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 80,
    "shotId": "vb_ch5_05_shot_4",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 84,
    "shotId": "vb_ch5_03_shot_5",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 89,
    "shotId": "vb_ch5_02_shot_6",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 93,
    "shotId": "vb_ch5_06_shot_6",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 98,
    "shotId": "vb_ch5_05_shot_7",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 102,
    "shotId": "vb_ch5_03_shot_8",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 107,
    "shotId": "vb_ch5_02_shot_9",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 111,
    "shotId": "vb_ch5_06_shot_9",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 116,
    "shotId": "vb_ch5_05_shot_10",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 120,
    "shotId": "vb_ch5_03_shot_11",
    "graphicSpec": {
      "version": 1,
      "claimId": "s9__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s9__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "ANIMATION OF THE WHOLE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 190,
    "shotId": "vb_ch7_s11_01_shot_1",
    "graphicSpec": {
      "version": 1,
      "claimId": "s11__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s11__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "A SINGLE DEFINITIVE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 194,
    "shotId": "vb_ch7_s11_01_shot_5",
    "graphicSpec": {
      "version": 1,
      "claimId": "s11__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s11__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "generic",
      "label": "A SINGLE DEFINITIVE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 199,
    "shotId": "vb_ch7_s12_01_shot_3",
    "graphicSpec": {
      "version": 1,
      "claimId": "s12__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s12__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "clock",
      "label": "ANY UNSUPPORTED PRECISE",
      "polarity": "unavailable"
    }
  },
  {
    "shotNumber": 203,
    "shotId": "vb_ch7_s12_01_shot_7",
    "graphicSpec": {
      "version": 1,
      "claimId": "s12__inline",
      "theme": "dark",
      "backgroundMode": "dark",
      "variantIndex": 0,
      "contractVersionId": "3df88d6b-9a66-43b4-be7e-46b34fed9777",
      "treatmentId": "s12__inline::SYMBOL_NEGATION",
      "template": "SYMBOL_NEGATION",
      "icon": "clock",
      "label": "ANY UNSUPPORTED PRECISE",
      "polarity": "unavailable"
    }
  }
]
```

## Reference-image leakage

75 current compiled scenes carry references. Character prompts explicitly say to preserve identity rather than pose. Non-character references do not consistently include an equivalent instruction against copying composition, layout, or embedded text, so prompt-level leakage risk remains. Among the 49 actual submissions, QA set `referenceLeakageDetected: true` for shots 36 and 38; their persisted provider payloads contain no `ref_images`, so those findings show reference-sheet/timeline-like output rather than proven copying from a supplied reference. Shots 16 and 21 did receive the Sun reference and QA did not flag reference leakage (shot 21 QA was unavailable).

## Previous-project hardcoding

No Mars, Viking, or Wi-Fi strings were found unless listed above in the search-term JSON. Source comments mention prior Mars incidents, but comments are not injected into compiled prompts or provider payloads.
