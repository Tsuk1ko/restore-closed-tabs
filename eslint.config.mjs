import config from '@tsuk1ko/eslint-config';
import tailwind from 'eslint-plugin-tailwindcss';
import autoImports from './.wxt/eslint-auto-imports.mjs';

export default config(undefined, autoImports, tailwind.configs.recommended);
