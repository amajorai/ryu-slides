<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./icon-dark.png" />
    <img src="./icon-light.png" alt="Slides" width="144" />
  </picture>
</p>

<div align="center">

# Slides

</div>

Create, edit, organize, and export visual slides and thumbnails locally with Ryu's media tools.

> **The public home of `ryu-slides`.** Source, builds, and releases live here —
> binaries for every platform are attached to each release.
>
> This tree is generated from the Ryu monorepo, so commits pushed here
> directly are replaced on the next sync. **Pull requests are welcome** —
> open them here and they are ported into the monorepo, then flow back out.
> Ryu as a whole: https://github.com/amajorai/ryu

## Install

**App:** [Install](ryu://apps/@ryu/slides) (opens the Ryu desktop app and asks you to confirm)

**CLI:**

```bash
ryu apps add @ryu/slides
```

## Source & build

This is the **source of record** for the app UI. It imports Ryu's private
`@ryu/ui` design system, so it does **not** build standalone outside the
monorepo — it **builds inside the amajorai/ryu monorepo workspace**.
The **shipped bundle below is the built artifact**: a prebuilt single-file
companion bundle is included at [`dist/slides.ui.html`](./dist/slides.ui.html) —
the runnable UI Ryu loads for this app.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Included workflow

- Create and search a local project gallery.
- Edit text, image, and shape layers with selection, movement, resizing,
  rotation, visibility, locking, z-order, duplication, and undo/redo.
- Upload images or videos through Ryu, capture still frames from a selected video,
  clean up near-white backgrounds, and request visuals from the configured Ryu media engine.
- Ask the configured Ryu model for a structured carousel layout.
- Export a project as PNG, JPEG, or WebP.

The app has no sidecar and does not call a provider directly. If a host bridge is
missing, the editor remains usable with local placeholders and clearly reports
which generation or upload capability is unavailable.
