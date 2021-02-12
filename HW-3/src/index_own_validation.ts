import _ from 'lodash';
import * as t from './my-own-validation';

('use strict');
let urlRoot = 'https://bad-api-assignment.reaktor.com';
let tbl = document.createElement('table');
addRow('Name', 'Type', 'Price', 'Availability');
document.body.appendChild(tbl);

let countFetchingInProgress = 0;

const ProdcutDetailsCodec = t.object({
  id: t.string,
  name: t.string,
  type: t.string,
  manufacturer: t.string,
  color: t.array(t.string),
  price: t.number,
});
type ProdcutDetails = ReturnType<typeof ProdcutDetailsCodec>;

type ProdcutDetailsAndAvailability = ProdcutDetails & {
  availability: string;
};

const AvailabilityDetailsCodec = t.object({
  id: t.string,
  DATAPAYLOAD: t.string,
});
type AvailabilityDetails = ReturnType<typeof AvailabilityDetailsCodec>;

const AvailabilityDetailsResponseCodec = t.object({
  code: t.number,
  response: t.array(AvailabilityDetailsCodec),
});
type AvailabilityDetailsResponse = ReturnType<typeof AvailabilityDetailsResponseCodec>;

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
  let prodcutPromises = ['jackets', 'shirts', 'accessories'].map((i) => getProductData(i));
  const productArrays: Array<Array<ProdcutDetails>> = [];

  prodcutPromises.forEach((promise) =>
    promise.then((result: ProdcutDetails[]) => {
      updateProductData(result, productArrays);
      console.log('Processing product callback ... ');
    })
  );

  await Promise.all(prodcutPromises);
  console.log('Populating product data done!!');
  return <Array<ProdcutDetailsAndAvailability>>productArrays.flat();
}

function getProductData(product: string): Promise<Array<ProdcutDetails>> {
  return fetchData<ProdcutDetails[]>(`${urlRoot}/products/${product}`, t.array(ProdcutDetailsCodec));
}

async function getAvailabilityData(manufacturer: string): Promise<Array<AvailabilityDetails>> {
  const data = fetchData<AvailabilityDetailsResponse>(
    `${urlRoot}/availability/${manufacturer}`,
    AvailabilityDetailsResponseCodec
  );

  return (await data).response;
}

async function fetchData<T>(url: string, validator: t.Validator<T>): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'x-force-error-mode': 'none',
    },
  });
  if (response.status != 200) {
    throw Error('FAILED TO FETCH');
  }

  const payload: T | undefined = await response.json();

  if (payload === undefined) {
    console.log(`Retrying to fetch data from: ${url}`);
    return fetchData<T>(url, validator);
  }

  return validator(payload);
}

function updateProductData(productResult: Array<ProdcutDetails>, products: Array<Array<ProdcutDetails>>) {
  products.push(productResult);

  addToTable(<Array<ProdcutDetailsAndAvailability>>productResult);
}

async function populateAvailabilityData(products: Array<ProdcutDetailsAndAvailability>) {
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
    const promise = updateAvailabilityData(m, availabilityData);
    promises.push(promise);
    promise.then((manufacturer) => {
      updateProductWithAvailability(manufacturer, products, availabilityData);
      console.log('Processing availability callback of manufacturer: ' + manufacturer);
    });
  });

  await Promise.all(promises);
  console.log('Populating availability data done!!');
}

async function updateAvailabilityData(manufacturer: string, availabilityData: AvailabilityData) {
  countFetchingInProgress++;

  const responseContent = await getAvailabilityData(manufacturer);

  availabilityData[manufacturer] = _.sortBy(responseContent, (r) => r.id);
  availabilityData[manufacturer].forEach((elem) => {
    elem.id = elem.id.toLowerCase();
    elem.DATAPAYLOAD = t.availability(elem.DATAPAYLOAD).availability;
  });

  return manufacturer;
}

function updateProductWithAvailability(
  manufacturer: string,
  products: Array<ProdcutDetailsAndAvailability>,
  availabilityData: AvailabilityData
) {
  const idsArray = availabilityData[manufacturer].map((i) => i.id);
  products.forEach((elem) => {
    if (elem.manufacturer == manufacturer) {
      const index = _.sortedIndexOf(idsArray, elem.id);
      if (index != -1) {
        elem.availability = availabilityData[manufacturer][index].DATAPAYLOAD;
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

function addToTable(items: ProdcutDetailsAndAvailability[]) {
  let i;
  for (i = 0; i < items.length; i++) {
    addRow(items[i].name, items[i].type, items[i].price, items[i].availability);
  }
}

function recreateTable(items: ProdcutDetailsAndAvailability[]) {
  tbl.innerHTML = '';
  addRow('Name', 'Type', 'Price', 'Availability');

  addToTable(items);
}

function addRow(name: string, type: string, price: string | number, availability: string) {
  let tr = tbl.insertRow();

  tr.insertCell().appendChild(document.createTextNode(name));
  tr.insertCell().appendChild(document.createTextNode(type));
  tr.insertCell().appendChild(document.createTextNode(price.toString()));
  tr.insertCell().appendChild(document.createTextNode(availability || ''));
}
