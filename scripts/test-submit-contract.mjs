const API = 'http://localhost:3001/api/v1';
const ts = Date.now().toString(36).toUpperCase();

async function req(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  console.log('1. Login...');
  const { accessToken } = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'sales@ems.com', password: 'admin123' }),
  });
  const auth = { Authorization: `Bearer ${accessToken}` };

  console.log('2. Load masters for destination port & fallback office...');
  const [offices, ports, countries] = await Promise.all([
    req('/offices', { headers: auth }),
    req('/masters/ports', { headers: auth }),
    req('/masters/countries', { headers: auth }),
  ]);

  const destinationPort = ports.find((p) => p.portType !== 'LOADING');
  const fallbackOffice = offices.find((o) => o.code === 'AMD') || offices[0];
  const buyerCountry = countries.find((c) => c.code === 'AU') || countries[0];

  if (!destinationPort) throw new Error('No destination port found');
  if (!fallbackOffice) throw new Error('No office found');

  const pendingOfficeId = `pending:office-${ts}`;
  const pendingSalespersonId = `pending:sp-${ts}`;
  const pendingCountryId = `pending:country-${ts}`;
  const pendingBuyerId = `pending:buyer-${ts}`;
  const pendingProductId = `pending:product-${ts}`;
  const pendingVariantId = `pending:variant-${ts}`;
  const pendingPackagingTypeId = `pending:pkg-${ts}`;
  const pendingPackagingSizeId = `pending:packsize-${ts}`;

  const buyerName = `Test Buyer ${ts}`;
  const buyerCode = `TB${ts.slice(-6)}`;

  const payload = {
    contract: {
      officeId: pendingOfficeId,
      contractDate: '2026-06-18',
      contractSentDate: '2026-06-18',
      signedContractReceivedDate: '2026-06-18',
      salespersonId: pendingSalespersonId,
      buyerId: pendingBuyerId,
      productId: pendingProductId,
      productVariantId: pendingVariantId,
      processingType: 'Normal',
      totalMt: 36,
      quantityUnit: 'MT',
      numberOfContainers: 2,
      incoterm: 'FOB',
      fobPrice: 2100,
      fobCurrency: 'USD',
      fobPriceUnit: 'PER_MT',
      exchangeRate: 83.5,
      freightUnit: 'PER_CONTAINER',
      cifManualOverride: false,
      paymentType: 'ADVANCE',
      advancePercentage: 20,
      balancePaymentMode: 'BANK',
      packagingTypeId: pendingPackagingTypeId,
      packagingSizeId: pendingPackagingSizeId,
      packingSizeValue: 25,
      packingSizeUnit: 'KG',
      packingDescription: 'PP OF 25 KG NET',
      destinationPortId: destinationPort.id,
      shipmentMonth: 'Jul-26',
      shipmentYear: 2026,
      shipmentHalf: 'FIRST_HALF',
      expectedShipmentDate: '2026-07-05',
      euClassification: 'NON_EU',
      status: 'UNDER_PREPARATION',
      containerProducts: [
        {
          containerIndex: 1,
          productId: pendingProductId,
          productVariantId: pendingVariantId,
          processingType: 'Normal',
          specification: 'Premium quality test spec',
          quantityMt: 18,
        },
        {
          containerIndex: 2,
          productId: pendingProductId,
          productVariantId: pendingVariantId,
          processingType: 'Normal',
          specification: 'Premium quality test spec',
          quantityMt: 18,
        },
      ],
    },
    pendingMasters: {
      offices: [{ id: pendingOfficeId, name: `Test Office ${ts}`, city: 'Mumbai' }],
      salespersons: [{ id: pendingSalespersonId, name: `Test Sales ${ts}` }],
      countries: [{ id: pendingCountryId, name: `Test Country ${ts}`, euClassification: 'NON_EU' }],
      buyers: [{ id: pendingBuyerId, name: buyerName, countryId: pendingCountryId }],
      products: [
        {
          id: pendingProductId,
          name: `Test Product ${ts}`,
          code: `TP${ts.slice(-4)}`,
          variants: [
            { id: pendingVariantId, name: 'Normal', code: 'NORMAL', processingType: 'Normal' },
          ],
        },
      ],
      productVariants: [],
      packagingTypes: [{ id: pendingPackagingTypeId, name: `Test PP ${ts}`, code: `PP${ts.slice(-4)}` }],
      packagingSizes: [
        {
          id: pendingPackagingSizeId,
          packagingTypeId: pendingPackagingTypeId,
          label: 'PP OF 25 KG NET',
          weightKg: 25,
          weightUnit: 'KG',
          weightValue: 25,
        },
      ],
    },
    buyerUpdate: {
      address: '123 Test Export Lane, Mumbai',
      contactPerson: 'Test Contact Person',
      email: `test.${ts.toLowerCase()}@example.com`,
      phone: '+91 9876543210',
      euClassification: 'NON_EU',
      code: buyerCode,
      countryId: pendingCountryId,
    },
  };

  console.log('3. Submit contract (36 MT, all new masters)...');
  const created = await req('/contracts/submit', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(payload),
  });

  console.log('\n✅ Contract created successfully!');
  console.log(`   Contract Number: ${created.contractNumber}`);
  console.log(`   Contract ID:     ${created.id}`);
  console.log(`   Total MT:        ${created.totalMt}`);
  console.log(`   Containers:      ${created.numberOfContainers}`);
  console.log(`   Buyer:           ${created.buyer?.name} (${created.buyer?.code})`);
  console.log(`   Office:          ${created.office?.name}`);
  console.log(`   Salesperson:     ${created.salesperson?.name}`);
  console.log(`   Product:         ${created.product?.name}`);
  console.log(`   Status:          ${created.status}`);
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
