// Kit: CC0 models (Kenney's kits in proto/assets/kenney, fetched by fetchKenney.mjs; sources in ASSET_SOURCES.md),
// in the toy-diorama look: each file loaded once (through the page's loading manager, so no frame renders before it
// has arrived), cloned per use, standing on its base, casting and taking shadows.
//   model(ctx, "car/sedan.glb", { pos, rotY, size (the longest side in metres) | scale, parent, tint, gloss }, onReady)

const cache = new Map();

/** a model placed in the scene (a Group, empty until the file has loaded; onReady(group, inner) then) */
export function model(ctx, file, opts = {}, onReady = null) {
  const { THREE } = ctx;
  const g = new THREE.Group();
  if (opts.pos) g.position.set(...opts.pos);
  g.rotation.y = opts.rotY ?? 0;
  (opts.parent ?? ctx.scene).add(g);
  if (!ctx.gltf) return g;
  if (!cache.has(file)) cache.set(file, new Promise((res) => ctx.gltf(`/assets/kenney/${file}`, res)));
  cache.get(file).then((gltf) => {
    const inner = gltf.scene.clone(true);
    // its base on y = 0, centred in x and z; sized by its longest side (or a plain scale)
    const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
    const k = opts.size ? opts.size / Math.max(size.x, size.z) : (opts.scale ?? 1);
    inner.scale.setScalar(k);
    inner.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
    inner.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = opts.cast !== false; o.receiveShadow = true;
      // its own material (a tint must not colour every other copy); a little sheen, like the toy plastic of the props
      o.material = o.material.clone();
      if (opts.tint) o.material.color = new THREE.Color(opts.tint);
      o.material.roughness = opts.gloss ?? 0.55;
      o.material.envMapIntensity = 0.8;
    });
    g.add(inner);
    onReady?.(g, inner);
  });
  return g;
}

/** a model's named nodes (wheels, doors) once loaded */
export function nodes(inner, re) {
  const out = []; inner.traverse((o) => { if (re.test(o.name)) out.push(o); }); return out;
}
