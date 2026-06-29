import bpy

# Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import FBX
fbx_path = "/Users/blondieboi/repos/game/model/FBX/KnightCharacter.fbx"
bpy.ops.import_scene.fbx(filepath=fbx_path)

# Export as GLB
glb_path = "/Users/blondieboi/repos/game/model/KnightCharacter.glb"
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    export_image_format='NONE',
)
print(f"Exported to {glb_path}")
