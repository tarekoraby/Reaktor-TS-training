import _ from 'lodash';

('use strict');
let urlRoot = 'https://bad-api-assignment.reaktor.com';
let tbl = document.createElement('table');
addRow('Name', 'Type', 'Price', 'Availability');
document.body.appendChild(tbl);

let countFetchingInProgress = 0;

type FetchedDetails = ProdcutDetails | AvailabilityDetails;

interface ProdcutDetails {
  id: string;
  name: string;
  type: string;
  availability: string;
  manufacturer: string;
  color: Array<string>;
  price: number;
}

interface AvailabilityDetails {
  id: string;
  DATAPAYLOAD: string;
  availability: string;
}

interface AvailabilityData {
  [manufacturer: string]: Array<AvailabilityDetails>;
}

run();

async function run() {
  const products = await populateProductData();
  await populateAvailabilityData(products);
}

async function populateProductData() {
  console.log('Populating product data started!!');
  const jackets = <Promise<Array<ProdcutDetails>>>fetchData(`${urlRoot}/products/jackets`);
  const shirts = <Promise<Array<ProdcutDetails>>>fetchData(`${urlRoot}/products/shirts`);
  const accessories = <Promise<Array<ProdcutDetails>>>fetchData(`${urlRoot}/products/accessories`);

  const productArrays: Array<Array<ProdcutDetails>> = [];

  [jackets, shirts, accessories].forEach((promise) =>
    promise.then((result: ProdcutDetails[]) => {
      updateProductData(result, productArrays);
      console.log('Processing product callback ... ');
    })
  );

  await Promise.all([jackets, shirts, accessories]);
  console.log('Populating product data done!!');
  return productArrays.flat();
}

async function fetchData(url: string): Promise<Array<FetchedDetails>> {
  const response = await fetch(url, {
    headers: {
      'x-force-error-mode': 'none',
    },
  });
  if (response.status != 200) {
    throw Error('FAILED TO FETCH');
  }

  const payload: FetchedDetails[] | { response: FetchedDetails[] } | undefined = await response.json();

  if (payload === undefined) {
    console.log(`Retrying to fetch data from: ${url}`);
    return fetchData(url);
  }

  if (Array.isArray(payload)) {
    return <ProdcutDetails[]>payload;
  } else {
    const responseContent = payload.response;
    if (Array.isArray(responseContent)) {
      return <AvailabilityDetails[]>responseContent;
    } else {
      console.log(`Retrying to fetch data from: ${url}`);
      return fetchData(url);
    }
  }
}

function updateProductData(productResult: Array<ProdcutDetails>, products: Array<Array<ProdcutDetails>>) {
  productResult.forEach((elem) => {
    elem.availability = '';
  });

  products.push(productResult);

  addToTable(productResult);
}

async function populateAvailabilityData(products: Array<ProdcutDetails>) {
  console.log('Populating availability data started!!');

  const manufacturers = Array.from(new Set(products.map((i) => i.manufacturer)));
  let statusElement = document.querySelector('#status');
  if (statusElement === null) {
    throw new Error('Status element missing!');
  }
  statusElement.textContent = 'Fetching availability data ...';

  let availabilityData: AvailabilityData = {};
  const promises: Array<Promise<string>> = [];
  manufacturers.map((m) => {
    const promise = updateAvailabilityData(m, products, availabilityData);
    promises.push(promise);
    promise.then((manufacturer) => {
      updateProductWithAvailability(manufacturer, products, availabilityData);
      console.log('Processing availability callback of manufacturer: ' + manufacturer);
    });
  });

  await Promise.all(promises);
  console.log('Populating availability data done!!');
}

async function updateAvailabilityData(
  manufacturer: string,
  products: Array<ProdcutDetails>,
  availabilityData: AvailabilityData
) {
  countFetchingInProgress++;

  const responseContent = await (<Promise<Array<AvailabilityDetails>>>(
    fetchData(`${urlRoot}/availability/${manufacturer}`)
  ));

  availabilityData[manufacturer] = _.sortBy(responseContent, (r) => r.id);
  availabilityData[manufacturer].forEach((elem) => {
    elem.id = elem.id.toLowerCase();
    let str = elem.DATAPAYLOAD.match(/(?<=<INSTOCKVALUE>)(.*)(?=<\/INSTOCKVALUE>)/);
    if (str !== null) {
      elem.availability = str[0].toLowerCase();
    }
  });

  return manufacturer;
}

function updateProductWithAvailability(
  manufacturer: string,
  products: Array<ProdcutDetails>,
  availabilityData: AvailabilityData
) {
  const idsArray = availabilityData[manufacturer].map((i) => i.id);
  products.forEach((elem) => {
    if (elem.manufacturer == manufacturer) {
      const index = _.sortedIndexOf(idsArray, elem.id);
      if (index != -1) {
        elem.availability = availabilityData[manufacturer][index].availability;
      }
    }
  });

  recreateTable(products);

  countFetchingInProgress--;
  if (countFetchingInProgress == 0) {
    let statusElement = document.querySelector('#status');
    if (statusElement === null) {
      throw new Error('Status element missing!');
    }
    statusElement.innerHTML = 'Done !!!';
  }
}

function addToTable(items: ProdcutDetails[]) {
  let i;
  for (i = 0; i < items.length; i++) {
    addRow(items[i].name, items[i].type, items[i].price, items[i].availability);
  }
}

function recreateTable(items: ProdcutDetails[]) {
  tbl.innerHTML = '';
  addRow('Name', 'Type', 'Price', 'Availability');

  addToTable(items);
}

function addRow(name: string, type: string, price: string | number, availability: string) {
  let tr = tbl.insertRow();

  tr.insertCell().appendChild(document.createTextNode(name));
  tr.insertCell().appendChild(document.createTextNode(type));
  tr.insertCell().appendChild(document.createTextNode(price.toString()));
  tr.insertCell().appendChild(document.createTextNode(availability));
}
