/**
 * RoleRoute — guards routes that require a specific user role.
 *
 * For now (Phase 0) this is a pass-through. In Phase 1, it will
 * check useAuthStore.user.role against the required role prop and
 * redirect users who don't have the correct role.
 *
 * @param {Object} props
 * @param {string} props.role       - The required role (e.g. "admin").
 * @param {JSX.Element} props.children - The child route element to render.
 * @returns {JSX.Element} The child element if the role matches.
 */
export default function RoleRoute({ role, children }) {
  // Phase 1 will add: if (user.role !== role) return <Navigate to="/" />
  return children;
}
