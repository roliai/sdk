// NOTE: This file is read at runtime from its location on disk so don't move it
// unless you update roli/framework/public/tools/src/util/transformer.ts


/*
// NOTE: These must match:
// PermissionProto at roli/schema/internal/service_interface.fbs
// Permission at roli/framework/public/tools/src/util/client-decorator-eval.ts (here)
// Permission at roli/framework/internal/system/src/roli-system-public.ts
*/

/**
 * Permissions that can be applied using the @permissions decorator to an Endpoint, Session, or Data derived Roli class.
 */
export enum Permission {
    // No access at all
    NoAccess=1,
    // Can create new instances of the object server-side
    Create=2,
    // Can read existing instances
    Read=4,
    // Can save changes where properties have been added/modified or removed.
    Write=8,
    // Can delete
    Delete=16,
}

// stub only used during client-side compilation
function permissions(x: any) { return x;}

// stub only used during client-side compilation
function authorize(x: any) { return x; }