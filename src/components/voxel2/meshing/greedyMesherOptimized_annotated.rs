use std::{
    collections::VecDeque,
    time::{Duration, Instant},
};

use bevy::{math::ivec3, prelude::*, utils::HashMap};

use crate::{
    chunk_mesh::ChunkMesh,
    chunks_refs::ChunksRefs,
    constants::{ADJACENT_AO_DIRS, CHUNK_SIZE, CHUNK_SIZE_P, CHUNK_SIZE_P2, CHUNK_SIZE_P3},
    face_direction::FaceDir,
    lod::Lod,
    utils::{generate_indices, make_vertex_u32, vec3_to_index},
};

// ================================================================================
// HIGH-LEVEL ALGORITHM OVERVIEW:
// 
// This is an optimized greedy meshing algorithm for voxel chunk rendering.
// The algorithm works in several phases:
//
// 1. SOLID VOXEL ENCODING: Convert the 3D voxel data into binary representations
//    along each axis (X, Y, Z). Each bit represents whether a voxel is solid.
//
// 2. FACE CULLING: Use bitwise operations to find visible faces by detecting
//    transitions between solid and air voxels.
//
// 3. FACE GROUPING: Group faces by their properties (block type, ambient occlusion)
//    and organize them into 2D binary planes.
//
// 4. GREEDY MESHING: For each 2D plane, use a greedy algorithm to combine
//    adjacent faces into larger rectangles, reducing triangle count.
//
// 5. MESH GENERATION: Convert the greedy quads into actual mesh vertices with
//    proper normals, UVs, and ambient occlusion data.
// ================================================================================

pub fn build_chunk_mesh(chunks_refs: &ChunksRefs, lod: Lod) -> Option<ChunkMesh> {
    // Early optimization: if the entire chunk is made of the same block type,
    // we can skip mesh generation entirely (either all air or all solid)
    if chunks_refs.is_all_voxels_same() {
        return None;
    }
    let mut mesh = ChunkMesh::default();

    // ================================================================================
    // PHASE 1: BINARY ENCODING OF SOLID VOXELS
    // ================================================================================
    
    // These arrays store binary representations of solid voxels along each axis.
    // For each axis (0=Y, 1=X, 2=Z), we store a 2D array where each u64 represents
    // a column of voxels along that axis. Each bit in the u64 represents whether
    // a voxel at that position is solid (1) or air (0).
    // 
    // axis_cols[0][z][x] = column along Y axis at position (x,z)
    // axis_cols[1][y][z] = column along X axis at position (y,z)
    // axis_cols[2][y][x] = column along Z axis at position (x,y)
    let mut axis_cols = [[[0u64; CHUNK_SIZE_P]; CHUNK_SIZE_P]; 3];

    // These arrays store which faces are visible (not culled) for each of the 6 directions.
    // Index mapping: 0=Down(-Y), 1=Up(+Y), 2=Left(-X), 3=Right(+X), 4=Forward(-Z), 5=Back(+Z)
    // A bit is set to 1 if a face at that position should be rendered.
    let mut col_face_masks = [[[0u64; CHUNK_SIZE_P]; CHUNK_SIZE_P]; 6];

    // Helper function to set bits in axis_cols based on voxel solidity
    #[inline]
    fn add_voxel_to_axis_cols(
        b: &crate::voxel::BlockData,
        x: usize,
        y: usize,
        z: usize,
        axis_cols: &mut [[[u64; 34]; 34]; 3],
    ) {
        if b.block_type.is_solid() {
            // Set the bit at position 'y' in the Y-axis column at (x,z)
            // This represents that there's a solid voxel at (x,y,z)
            axis_cols[0][z][x] |= 1u64 << y as u64;
            
            // Set the bit at position 'x' in the X-axis column at (y,z)
            axis_cols[1][y][z] |= 1u64 << x as u64;
            
            // Set the bit at position 'z' in the Z-axis column at (x,y)
            axis_cols[2][y][x] |= 1u64 << z as u64;
        }
    }

    // ================================================================================
    // STEP 1.1: Process inner chunk voxels
    // ================================================================================
    
    // Get the center chunk (index 1,1,1 in a 3x3x3 chunk grid)
    // The chunks_refs contains the current chunk and its 26 neighbors
    let chunk = &*chunks_refs.chunks[vec3_to_index(IVec3::new(1, 1, 1), 3)];
    
    // Chunks can be stored in two formats:
    // - Full format: CHUNK_SIZE³ voxels stored individually
    // - Compressed format: 1 voxel repeated for the entire chunk
    assert!(chunk.voxels.len() == CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE || chunk.voxels.len() == 1);
    
    // Iterate through all voxels in the chunk
    for z in 0..CHUNK_SIZE {
        for y in 0..CHUNK_SIZE {
            for x in 0..CHUNK_SIZE {
                // Handle both storage formats
                let i = match chunk.voxels.len() {
                    1 => 0, // Compressed: always use the single voxel
                    _ => (z * CHUNK_SIZE + y) * CHUNK_SIZE + x, // Full: calculate index
                };
                // Add 1 to coordinates because axis_cols has padding for neighbor voxels
                add_voxel_to_axis_cols(&chunk.voxels[i], x + 1, y + 1, z + 1, &mut axis_cols)
            }
        }
    }

    // ================================================================================
    // STEP 1.2: Process neighbor chunk voxels (for proper face culling at boundaries)
    // ================================================================================
    
    // We need to sample voxels from neighboring chunks to properly cull faces
    // at chunk boundaries. Without this, faces between chunks would always be visible.
    
    // Process Z-axis boundaries (front and back faces of the chunk)
    for z in [0, CHUNK_SIZE_P - 1] {
        for y in 0..CHUNK_SIZE_P {
            for x in 0..CHUNK_SIZE_P {
                // Convert padded coordinates to world coordinates
                let pos = ivec3(x as i32, y as i32, z as i32) - IVec3::ONE;
                add_voxel_to_axis_cols(chunks_refs.get_block(pos), x, y, z, &mut axis_cols);
            }
        }
    }
    
    // Process Y-axis boundaries (top and bottom faces of the chunk)
    for z in 0..CHUNK_SIZE_P {
        for y in [0, CHUNK_SIZE_P - 1] {
            for x in 0..CHUNK_SIZE_P {
                let pos = ivec3(x as i32, y as i32, z as i32) - IVec3::ONE;
                add_voxel_to_axis_cols(chunks_refs.get_block(pos), x, y, z, &mut axis_cols);
            }
        }
    }
    
    // Process X-axis boundaries (left and right faces of the chunk)
    for z in 0..CHUNK_SIZE_P {
        for x in [0, CHUNK_SIZE_P - 1] {
            for y in 0..CHUNK_SIZE_P {
                let pos = ivec3(x as i32, y as i32, z as i32) - IVec3::ONE;
                add_voxel_to_axis_cols(chunks_refs.get_block(pos), x, y, z, &mut axis_cols);
            }
        }
    }

    // ================================================================================
    // PHASE 2: FACE CULLING USING BITWISE OPERATIONS
    // ================================================================================
    
    // This is the key optimization: we use bitwise operations to detect transitions
    // between solid and air voxels, which indicate visible faces.
    for axis in 0..3 {
        for z in 0..CHUNK_SIZE_P {
            for x in 0..CHUNK_SIZE_P {
                // Get the column of solid/air bits for this position
                let col = axis_cols[axis][z][x];

                // DESCENDING DIRECTION (negative axis direction):
                // col & !(col << 1) finds transitions from solid to air
                // Example: col = 0b00111000
                //          col << 1 = 0b01110000
                //          !(col << 1) = 0b10001111
                //          col & !(col << 1) = 0b00001000
                // This gives us a 1 where a solid voxel has air below it
                col_face_masks[2 * axis + 0][z][x] = col & !(col << 1);
                
                // ASCENDING DIRECTION (positive axis direction):
                // col & !(col >> 1) finds transitions from air to solid
                // Example: col = 0b00111000
                //          col >> 1 = 0b00011100
                //          !(col >> 1) = 0b11100011
                //          col & !(col >> 1) = 0b00100000
                // This gives us a 1 where a solid voxel has air above it
                col_face_masks[2 * axis + 1][z][x] = col & !(col >> 1);
            }
        }
    }

    // ================================================================================
    // PHASE 3: GROUP FACES BY PROPERTIES AND BUILD 2D PLANES
    // ================================================================================
    
    // We group faces by their properties to enable greedy meshing.
    // Faces can only be merged if they have:
    // - Same block type
    // - Same ambient occlusion pattern
    // - Same normal direction (already separated by axis)
    //
    // Structure: data[axis][block_hash][y_level] = 32x32 binary plane
    // where block_hash encodes both block type and AO pattern
    let mut data: [HashMap<u32, HashMap<u32, [u32; 32]>>; 6];
    data = [
        HashMap::new(),
        HashMap::new(),
        HashMap::new(),
        HashMap::new(),
        HashMap::new(),
        HashMap::new(),
    ];

    // Process each axis direction separately
    for axis in 0..6 {
        for z in 0..CHUNK_SIZE {
            for x in 0..CHUNK_SIZE {
                // Get the column of face bits for this position
                // Add 1 to skip padding
                let mut col = col_face_masks[axis][z + 1][x + 1];

                // Remove padding bits:
                // Right shift by 1 to remove bottom padding
                col >>= 1;
                // Clear the top bit to remove top padding
                col &= !(1 << CHUNK_SIZE as u64);

                // Process each set bit (visible face) in the column
                while col != 0 {
                    // Find the position of the lowest set bit
                    let y = col.trailing_zeros();
                    // Clear the lowest set bit for next iteration
                    // This is the Brian Kernighan algorithm for bit manipulation
                    col &= col - 1;

                    // Convert axis-relative coordinates to world coordinates
                    // The mapping depends on which face direction we're processing
                    let voxel_pos = match axis {
                        0 | 1 => ivec3(x as i32, y as i32, z as i32), // Y-axis (down/up)
                        2 | 3 => ivec3(y as i32, z as i32, x as i32), // X-axis (left/right)
                        _ => ivec3(x as i32, z as i32, y as i32),     // Z-axis (forward/back)
                    };

                    // ================================================================================
                    // AMBIENT OCCLUSION CALCULATION
                    // ================================================================================
                    
                    // Ambient occlusion (AO) darkens corners where multiple solid blocks meet.
                    // We sample 8 positions around each face vertex to determine AO strength.
                    // The bit pattern encodes which of the 8 surrounding positions have solid blocks.
                    let mut ao_index = 0;
                    
                    // ADJACENT_AO_DIRS contains 8 2D offsets for sampling around a face
                    for (ao_i, ao_offset) in ADJACENT_AO_DIRS.iter().enumerate() {
                        // Convert 2D face offset to 3D world offset based on face direction
                        let ao_sample_offset = match axis {
                            0 => ivec3(ao_offset.x, -1, ao_offset.y), // Down face
                            1 => ivec3(ao_offset.x, 1, ao_offset.y),  // Up face
                            2 => ivec3(-1, ao_offset.y, ao_offset.x), // Left face
                            3 => ivec3(1, ao_offset.y, ao_offset.x),  // Right face
                            4 => ivec3(ao_offset.x, ao_offset.y, -1), // Forward face
                            _ => ivec3(ao_offset.x, ao_offset.y, 1),  // Back face
                        };
                        
                        // Sample the voxel at the AO position
                        let ao_voxel_pos = voxel_pos + ao_sample_offset;
                        let ao_block = chunks_refs.get_block(ao_voxel_pos);
                        
                        // Set bit if position has a solid block
                        if ao_block.block_type.is_solid() {
                            ao_index |= 1u32 << ao_i;
                        }
                    }

                    // Get the block type of the current voxel
                    let current_voxel = chunks_refs.get_block_no_neighbour(voxel_pos);
                    
                    // Create a hash that combines block type and AO pattern
                    // Lower 9 bits: AO pattern (8 bits + 1 reserved)
                    // Upper bits: Block type ID
                    let block_hash = ao_index | ((current_voxel.block_type as u32) << 9);
                    
                    // Store this face in the appropriate 2D binary plane
                    // Faces with the same block_hash can be greedy meshed together
                    let data = data[axis]
                        .entry(block_hash)
                        .or_default()
                        .entry(y)
                        .or_default();
                    
                    // Set the bit corresponding to this face's position in the 2D plane
                    data[x as usize] |= 1u32 << z as u32;
                }
            }
        }
    }

    // ================================================================================
    // PHASE 4: GREEDY MESHING AND VERTEX GENERATION
    // ================================================================================
    
    let mut vertices = vec![];
    
    // Process each axis direction
    for (axis, block_ao_data) in data.into_iter().enumerate() {
        // Convert axis index to face direction enum
        let facedir = match axis {
            0 => FaceDir::Down,
            1 => FaceDir::Up,
            2 => FaceDir::Left,
            3 => FaceDir::Right,
            4 => FaceDir::Forward,
            _ => FaceDir::Back,
        };
        
        // Process each unique block type + AO combination
        for (block_ao, axis_plane) in block_ao_data.into_iter() {
            // Extract AO pattern and block type from the hash
            let ao = block_ao & 0b111111111; // Lower 9 bits
            let block_type = block_ao >> 9;   // Upper bits
            
            // Process each Y-level (or equivalent axis level) separately
            for (axis_pos, plane) in axis_plane.into_iter() {
                // Run the greedy meshing algorithm on this 2D binary plane
                let quads_from_axis = greedy_mesh_binary_plane(plane, lod_size as u32);

                // Convert each greedy quad to actual mesh vertices
                quads_from_axis.into_iter().for_each(|q| {
                    q.append_vertices(&mut vertices, facedir, axis_pos, &Lod::L32, ao, block_type)
                });
            }
        }
    }

    // ================================================================================
    // PHASE 5: FINALIZE MESH
    // ================================================================================
    
    mesh.vertices.extend(vertices);
    
    // If no vertices were generated, return None (chunk is empty or fully culled)
    if mesh.vertices.is_empty() {
        None
    } else {
        // Generate indices for the vertices (standard quad indices)
        mesh.indices = generate_indices(mesh.vertices.len());
        Some(mesh)
    }
}

// Represents a rectangle of faces that have been merged together
#[derive(Debug)]
pub struct GreedyQuad {
    pub x: u32, // X position in the 2D plane
    pub y: u32, // Y position in the 2D plane
    pub w: u32, // Width of the rectangle
    pub h: u32, // Height of the rectangle
}

impl GreedyQuad {
    /// Converts this greedy quad into 4 vertices and appends them to the vertex buffer
    pub fn append_vertices(
        &self,
        vertices: &mut Vec<u32>,
        face_dir: FaceDir,
        axis: u32,
        lod: &Lod,
        ao: u32,
        block_type: u32,
    ) {
        let axis = axis as i32;
        let jump = lod.jump_index();

        // ================================================================================
        // AMBIENT OCCLUSION VERTEX CALCULATION
        // ================================================================================
        
        // The AO value contains 9 bits representing which of the 8 surrounding positions
        // (plus center) contain solid blocks. We need to calculate the AO strength for
        // each of the 4 vertices of the quad.
        //
        // Bit layout around a face (looking at the face):
        // 0---1---2
        // |       |
        // 3   4   5
        // |       |
        // 6---7---8
        //
        // For each vertex, we average the AO contribution from 3 surrounding positions:
        
        // Vertex 1 (bottom-left): affected by positions 0, 1, 3
        let v1ao = ((ao >> 0) & 1) + ((ao >> 1) & 1) + ((ao >> 3) & 1);
        
        // Vertex 2 (bottom-right): affected by positions 3, 6, 7
        let v2ao = ((ao >> 3) & 1) + ((ao >> 6) & 1) + ((ao >> 7) & 1);
        
        // Vertex 3 (top-right): affected by positions 5, 7, 8
        let v3ao = ((ao >> 5) & 1) + ((ao >> 8) & 1) + ((ao >> 7) & 1);
        
        // Vertex 4 (top-left): affected by positions 1, 2, 5
        let v4ao = ((ao >> 1) & 1) + ((ao >> 2) & 1) + ((ao >> 5) & 1);

        // Create compressed vertex data for each corner of the quad
        // Each vertex is packed into a single u32 with position, AO, normal, and block type
        let v1 = make_vertex_u32(
            face_dir.world_to_sample(axis as i32, self.x as i32, self.y as i32, &lod) * jump,
            v1ao,
            face_dir.normal_index(),
            block_type,
        );
        let v2 = make_vertex_u32(
            face_dir.world_to_sample(
                axis as i32,
                self.x as i32 + self.w as i32,
                self.y as i32,
                &lod,
            ) * jump,
            v2ao,
            face_dir.normal_index(),
            block_type,
        );
        let v3 = make_vertex_u32(
            face_dir.world_to_sample(
                axis as i32,
                self.x as i32 + self.w as i32,
                self.y as i32 + self.h as i32,
                &lod,
            ) * jump,
            v3ao,
            face_dir.normal_index(),
            block_type,
        );
        let v4 = make_vertex_u32(
            face_dir.world_to_sample(
                axis as i32,
                self.x as i32,
                self.y as i32 + self.h as i32,
                &lod,
            ) * jump,
            v4ao,
            face_dir.normal_index(),
            block_type,
        );

        // Create initial vertex order
        let mut new_vertices = VecDeque::from([v1, v2, v3, v4]);

        // ================================================================================
        // WINDING ORDER CORRECTION
        // ================================================================================
        
        // Some face directions need reversed winding order for correct backface culling
        if face_dir.reverse_order() {
            // Keep first vertex, reverse the rest: [v1, v2, v3, v4] -> [v1, v4, v3, v2]
            let o = new_vertices.split_off(1);
            o.into_iter().rev().for_each(|i| new_vertices.push_back(i));
        }

        // ================================================================================
        // ANISOTROPY FIX
        // ================================================================================
        
        // When opposite corners have different AO values, we need to rotate the quad
        // to prevent visual artifacts. This ensures the diagonal edge of the two
        // triangles doesn't create an incorrect lighting gradient.
        if (v1ao > 0) ^ (v3ao > 0) {
            // Rotate vertices: [a, b, c, d] -> [b, c, d, a]
            let f = new_vertices.pop_front().unwrap();
            new_vertices.push_back(f);
        }

        vertices.extend(new_vertices);
    }
}

// ================================================================================
// GREEDY MESHING ALGORITHM FOR 2D BINARY PLANES
// ================================================================================
/// Converts a 32x32 binary plane into optimally merged rectangles
/// Each bit in the input represents a face that needs to be rendered
pub fn greedy_mesh_binary_plane(mut data: [u32; 32], lod_size: u32) -> Vec<GreedyQuad> {
    let mut greedy_quads = vec![];
    
    // Process each row of the 32x32 grid
    for row in 0..data.len() {
        let mut y = 0;
        
        // Process all faces in this row
        while y < lod_size {
            // Skip empty space (0 bits) to find the next face
            // trailing_zeros counts consecutive 0s from the right
            y += (data[row] >> y).trailing_zeros();
            
            if y >= lod_size {
                // Reached the end of this row
                continue;
            }
            
            // Find the height of consecutive faces starting at position y
            // trailing_ones counts consecutive 1s from the right
            let h = (data[row] >> y).trailing_ones();
            
            // Create a bitmask for the height of this strip
            // Examples: h=1 -> 0b1, h=2 -> 0b11, h=4 -> 0b1111
            // The checked_shl handles the edge case where h=32 (shift overflow)
            let h_as_mask = u32::checked_shl(1, h).map_or(!0, |v| v - 1);
            
            // Create a mask for this strip at the correct position
            let mask = h_as_mask << y;
            
            // ================================================================================
            // HORIZONTAL EXPANSION
            // ================================================================================
            
            // Try to expand this rectangle horizontally to merge with adjacent rows
            let mut w = 1;
            while row + w < lod_size as usize {
                // Check if the next row has the same pattern of faces at this height
                // Extract bits at positions [y, y+h) from the next row
                let next_row_h = (data[row + w] >> y) & h_as_mask;
                
                // If the pattern doesn't match exactly, we can't expand further
                if next_row_h != h_as_mask {
                    break;
                }

                // Clear the bits we're merging from the next row
                // This prevents them from being processed again
                data[row + w] = data[row + w] & !mask;

                w += 1;
            }
            
            // Create the greedy quad representing this merged rectangle
            greedy_quads.push(GreedyQuad {
                y,
                w: w as u32,
                h,
                x: row as u32,
            });
            
            // Move to the next potential face in this row
            y += h;
        }
    }
    
    greedy_quads
}