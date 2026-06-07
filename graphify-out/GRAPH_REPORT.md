# Graph Report - .  (2026-06-07)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 390 nodes · 825 edges · 21 communities (15 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Gameplay Story Logic|Gameplay Story Logic]]
- [[_COMMUNITY_Boot Assets Memory|Boot Assets Memory]]
- [[_COMMUNITY_Narrative Overlay UI|Narrative Overlay UI]]
- [[_COMMUNITY_Gameplay Scene Core|Gameplay Scene Core]]
- [[_COMMUNITY_Story Art Themes|Story Art Themes]]
- [[_COMMUNITY_Overlay Tests Harness|Overlay Tests Harness]]
- [[_COMMUNITY_Final Memory Scene|Final Memory Scene]]
- [[_COMMUNITY_Bedroom Player Positioning|Bedroom Player Positioning]]
- [[_COMMUNITY_Package Scripts|Package Scripts]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Message Bubble State|Message Bubble State]]
- [[_COMMUNITY_Room Render Cleanup|Room Render Cleanup]]
- [[_COMMUNITY_Bedroom Asset Layers|Bedroom Asset Layers]]
- [[_COMMUNITY_Audio Movement Events|Audio Movement Events]]
- [[_COMMUNITY_Epilogue Video Scene|Epilogue Video Scene]]
- [[_COMMUNITY_Speech Bubble Module|Speech Bubble Module]]
- [[_COMMUNITY_Interaction Focus Loop|Interaction Focus Loop]]

## God Nodes (most connected - your core abstractions)
1. `Interactable` - 22 edges
2. `Chained by Other People's Shadows` - 22 edges
3. `compilerOptions` - 14 edges
4. `setPlayerIdle()` - 13 edges
5. `MenuScene` - 10 edges
6. `drawRoom()` - 9 edges
7. `getVisibleInteractables()` - 8 edges
8. `GameState` - 8 edges
9. `playPlayerWalk()` - 8 edges
10. `createInteractableView()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Chained by People's Shadow` --semantically_similar_to--> `Chained by Other People's Shadows`  [AMBIGUOUS] [semantically similar]
  index.html → README.md
- `Player Character Sprite Set` --conceptually_related_to--> `Raka`  [INFERRED]
  public/assets/characters/player/Sprite_0000.png → README.md
- `Blue Bedroom Night Overlay` --conceptually_related_to--> `Day Night Cycle`  [INFERRED]
  public/assets/environment/bedroom/BG_Nighttime_Multiply.png → README.md
- `Family Ending Sketch` --conceptually_related_to--> `Family Relationships`  [INFERRED]
  public/assets/endings/family-end.png → README.md
- `Friends Ending Sketch` --conceptually_related_to--> `Friendship`  [INFERRED]
  public/assets/endings/friends-end.png → README.md

## Import Cycles
- None detected.

## Communities (21 total, 6 thin omitted)

### Community 0 - "Gameplay Story Logic"
Cohesion: 0.06
Nodes (9): ArrowMinigameState, DialogueNode, FakeButton, FakeClassList, FakeDialogueLayer, FakeDialogueRoot, FakeRoot, FakeTextElement (+1 more)

### Community 1 - "Boot Assets Memory"
Cohesion: 0.07
Nodes (26): assetManifest, MenuScene, AssetManifest, RoomId, config, bedroomClockFrameKeys, bedroomInteractableIds, bedroomLayerDepths (+18 more)

### Community 2 - "Narrative Overlay UI"
Cohesion: 0.11
Nodes (27): rooms, actionsRequired, advanceArrowProgress(), advancePhase(), applyChoice(), buildUpRequired, canInteract(), clearArrowMinigame() (+19 more)

### Community 4 - "Story Art Themes"
Cohesion: 0.06
Nodes (33): Blue Bedroom Night Overlay, Family Ending Sketch, Friends Ending Sketch, Prayer Ending Sketch, Chained by People's Shadow, Game Container, HTML App Shell, src/main.ts Module Script (+25 more)

### Community 5 - "Overlay Tests Harness"
Cohesion: 0.15
Nodes (4): playPlayerWalk(), setBedroomClockFrame(), setPlayerFlip(), setPlayerIdle()

### Community 6 - "Final Memory Scene"
Cohesion: 0.14
Nodes (4): FinalMemoryDefinition, FinalMemoryPhase, FinalMemoryView, createPlayer()

### Community 8 - "Package Scripts"
Cohesion: 0.12
Nodes (15): dependencies, phaser, devDependencies, typescript, vite, vitest, name, private (+7 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 12 - "Room Render Cleanup"
Cohesion: 0.20
Nodes (11): Bedroom Background, Single Bed, Blue Screen Glow, Desk Chair, Wall Clock, Work Desk, Bedroom Door, Composed Bedroom Scene (+3 more)

### Community 13 - "Bedroom Asset Layers"
Cohesion: 0.22
Nodes (3): MailBubbleOptions, setMailBubbleHighlighted(), setInteractableHighlighted()

### Community 17 - "Speech Bubble Module"
Cohesion: 0.33
Nodes (4): BubbleTailDirection, BubbleTheme, DEFAULT_THEME, SpeechBubbleContainer

## Ambiguous Edges - Review These
- `Chained by Other People's Shadows` → `Chained by People's Shadow`  [AMBIGUOUS]
  index.html · relation: semantically_similar_to
- `Wall Clock` → `Mosque Dome Icon`  [AMBIGUOUS]
  public/assets/ui/kubah.png · relation: conceptually_related_to

## Knowledge Gaps
- **76 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Chained by Other People's Shadows` and `Chained by People's Shadow`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Wall Clock` and `Mosque Dome Icon`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `MenuScene` connect `Boot Assets Memory` to `Gameplay Story Logic`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `setPlayerIdle()` connect `Overlay Tests Harness` to `Boot Assets Memory`, `Gameplay Scene Core`, `Final Memory Scene`, `Bedroom Player Positioning`, `Message Bubble State`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _77 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Gameplay Story Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.05875706214689266 - nodes in this community are weakly interconnected._
- **Should `Boot Assets Memory` be split into smaller, more focused modules?**
  _Cohesion score 0.06868686868686869 - nodes in this community are weakly interconnected._