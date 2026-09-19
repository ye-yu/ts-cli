export function stringify(value: unknown, reducer?: (key: string, value: unknown) => unknown, space?: string | number): string {
    return JSON.stringify(value, reducer ?? ((_, value) => {
        if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
            // just flatten into one line
            return `[${value.join(', ')}]`;
        }
        return value;
    }), space);
}