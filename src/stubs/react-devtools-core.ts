// Stub for the optional `react-devtools-core` dependency that Ink only imports
// when the DEV env var is "true". We never ship devtools, so this no-op keeps
// the compiled binary self-contained without pulling in the real package.
export default {
    connectToDevTools() {
        /* no-op */
    },
};
