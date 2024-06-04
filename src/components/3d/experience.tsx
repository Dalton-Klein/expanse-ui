import { extend } from "@react-three/fiber";

const Experience = () => {
  return (
    <mesh position={[0, -1, 0]}>
      <boxGeometry attach="geometry" args={[2, 2, 2]} />
      <meshStandardMaterial color={"red"} />
    </mesh>
  );
};

export default Experience;
