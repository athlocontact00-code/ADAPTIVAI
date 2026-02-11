## AdaptivAI marketing/auth tokens (v1)

Goal: **Apple-like dark minimal** + subtle **sunset glow**. Use existing CSS variables where possible and layer marketing-only effects via utilities.

### Surfaces
- **Base background**: `bg-background` (dark graphite)
- **Glass / card**: `bg-card/40` + `backdrop-blur` + `border border-white/10`
- **Divider**: `border-white/10` (soft)

### Text
- **Primary**: `text-foreground` (92% white in dark)
- **Secondary**: `text-muted-foreground` / `text-secondary-app`
- **Micro**: `text-subtle` / `text-muted-app`

### Radius
- **Card**: `rounded-card` / `rounded-3xl` for hero containers
- **Control**: `rounded-control`
- **Pill**: `rounded-pill`

### Shadows
- **Soft**: `shadow-soft`
- **Card**: `shadow-card` (used sparingly)

### Sunset glow
Use a **radial glow** behind hero + key sections:
- `radial-gradient(600px circle at 20% 10%, rgba(255, 122, 24, .18), transparent 55%)`
- `radial-gradient(700px circle at 80% 0%, rgba(168, 85, 247, .14), transparent 60%)`
- `radial-gradient(900px circle at 50% 100%, rgba(30, 58, 138, .18), transparent 60%)`

### Grain
Very subtle (do not distract):
- prefer **baked into processed images** (sharp pipeline)
- optional global overlay for marketing/auth: `opacity: .08` + `mix-blend-mode: overlay`

