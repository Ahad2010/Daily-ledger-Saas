# Daily Ledger anatomy model

Source: https://github.com/JMK712/human-anatomy-online/blob/main/public/models/muscular.glb
Exported from Z-Anatomy: https://github.com/Z-Anatomy/Models-of-human-anatomy

Z-Anatomy — The libre 3D atlas of anatomy — CC BY-SA 4.0.
Authors: Gauthier Kervyn, Marcin Zielinski, Lluis Vinent; original BodyParts3D model by Kousaku Okubo.
BodyParts3D — © The Database Center for Life Science — CC BY-SA 2.1 Japan.
https://creativecommons.org/licenses/by-sa/4.0/
https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en
Original attribution retained in SOURCE-LICENSE.txt. Muscular-system geometry only; no supplementary ear/kidney assets.

Daily Ledger modifications: omitted atlas labels, enclosing fascia, bursae and tendon sheaths; explicit anatomical-name-to-exercise-region metadata; pruned unused data; simplified mesh topology (ratio 0.05, maximum error 0.02) then simplified again (ratio 0.3, maximum error 0.03) and recompressed Draco. Display materials replaced at runtime. Modified geometry asset is distributed under CC BY-SA 4.0, retaining underlying BodyParts3D attribution. No endorsement implied. The asset license does not change application code licensing.

Reproduce: download the source to muscular.glb, run scripts/prepare-fitness-model.mjs, then gltf-transform prune artifacts/muscular-selected.glb public/fitness/models/muscular.glb. Then gltf-transform simplify muscular.glb muscular-light.glb --ratio 0.05 --error 0.02, and gltf-transform draco muscular-light.glb muscular.glb. Further simplify with ratio 0.3/error 0.03 and compress again. Run prepare-fitness-model.mjs --regions; gltf-transform join muscular-regions.glb muscular-joined.glb --keepNamed false; compress again with draco. Final model: 503,432 bytes; 106,443 triangles; 12 region meshes. Region materials retain explicit fitnessMuscle metadata; neutral geometry remains unselectable. Runtime uses cached geometry and lightweight diffuse materials. Decoder supplied locally from Three.js examples/jsm/libs/draco/gltf (Apache-2.0).

muscle-mapping.json lists exact source node names. Core maps rectus abdominis/abdominal obliques (Abs); Quads maps rectus femoris/vastus (Quadriceps). Unmapped anatomy stays neutral. This is an anatomical visualization, not a diagnosis or muscle-growth measurement.



