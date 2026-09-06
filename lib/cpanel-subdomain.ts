export type SubdomainCreateInput = {
  label: string;
  parentDomain: string;
};

export function isCpanelSuccessStatus(status: unknown) {
  return status === 1 || status === '1' || status === true;
}

export function buildSubdomainCreateQuery(input: SubdomainCreateInput) {
  const hostname = `${input.label}.${input.parentDomain}`;
  return {
    domain: input.label,
    rootdomain: input.parentDomain,
    dir: `public_html/${hostname}`,
    disallowdot: '1',
  };
}

export async function issueSubdomainCreate(
  call: (module: string, fn: string, query: Record<string, string>) => Promise<unknown>,
  input: SubdomainCreateInput,
) {
  return call('SubDomain', 'addsubdomain', buildSubdomainCreateQuery(input));
}
