import { expect } from '@esm-bundle/chai';
import { fetchData } from '../../scripts/utils/fetch-data.js';

describe('fetchData', () => {
  let originalFetch;
  let fetchCalls;

  beforeEach(() => {
    originalFetch = window.fetch;
    fetchCalls = [];
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  const mockFetch = (response) => {
    window.fetch = (...args) => {
      fetchCalls.push(args);
      return Promise.resolve(response);
    };
  };

  const mockFetchReject = (error) => {
    window.fetch = (...args) => {
      fetchCalls.push(args);
      return Promise.reject(error);
    };
  };

  it('returns parsed JSON on successful fetch', async () => {
    const payload = { data: [{ name: 'test' }] };
    mockFetch({ ok: true, json: () => Promise.resolve(payload) });

    const result = await fetchData('https://example.com/data-success.json');
    expect(result).to.deep.equal(payload);
  });

  it('returns null on HTTP error', async () => {
    mockFetch({ ok: false, status: 404 });

    const result = await fetchData('https://example.com/data-404.json');
    expect(result).to.be.null;
  });

  it('returns null on network error', async () => {
    mockFetchReject(new Error('Network failure'));

    const result = await fetchData('https://example.com/data-network-error.json');
    expect(result).to.be.null;
  });

  it('caches responses — second call does not trigger another fetch', async () => {
    const payload = { data: [{ cached: true }] };
    mockFetch({ ok: true, json: () => Promise.resolve(payload) });

    const url = 'https://example.com/data-cache-test.json';
    const first = await fetchData(url);
    const second = await fetchData(url);

    expect(first).to.deep.equal(payload);
    expect(second).to.deep.equal(payload);
    expect(fetchCalls.length).to.equal(1);
  });

  it('handles sheet option as a string', async () => {
    const payload = { data: [] };
    mockFetch({ ok: true, json: () => Promise.resolve(payload) });

    await fetchData('https://example.com/data-sheet-string.json', { sheet: 'products' });
    expect(fetchCalls[0][0]).to.equal('https://example.com/data-sheet-string.json?sheet=products');
  });

  it('handles sheet option as an array of multiple sheets', async () => {
    const payload = { products: { data: [] }, categories: { data: [] } };
    mockFetch({ ok: true, json: () => Promise.resolve(payload) });

    await fetchData('https://example.com/data-sheet-array.json', { sheet: ['products', 'categories'] });
    const calledUrl = fetchCalls[0][0];
    expect(calledUrl).to.include('sheet=products');
    expect(calledUrl).to.include('sheet=categories');
  });
});
