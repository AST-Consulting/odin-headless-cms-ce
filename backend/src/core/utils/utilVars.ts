/* eslint-disable @typescript-eslint/naming-convention */
export const typeFields = [
  '_number_',
  '_string_',
  '_boolean_',
  '_noexact_',
  '_noexact_i_',
  '_exact_',
  '_exact_i_',
];

export const excludedFields = [
  'page',
  'sort',
  'limit',
  'fields',
  'search',
  // 'searchField',
  'exists',
  'in',
  'reguex',
  'strict',
  'date',
];

export const regexFields = [
  'name',
  'code',
  'rank',
  'email',
  'role',
  'entity.name',
  'customer.customerName',
  'customer.email',
  'customer.phone',
  'pickupAgent.pickupAgentName',
  'pickupAgent.email',
  'store.storeName',
  'owner.name',
  'owner.email',
  'vehicleInfo.vehicleType',
  'user.email',
  'contactInfo.email',
  'type',
  'label',
  'location.name',
  'category.name',
  'pincode',
  'state',
  'city',
];

export const DATE_FIELDS = [
  'createdAt',
  'updatedAt',
  'deliveredAt',
  'failedAt',
  'date',
  'modifiedAt',
  'startDate',
  'endDate',
];

export const nonRegexFields = ['_id'];

export enum TComparisonOperators {
  GTE = 'gte',
  GT = 'gt',
  LTE = 'lte',
  LT = 'lt',
}

// Convert the enum to an array of its values for use in the validation logic
export const comparisonOperators = Object.values(TComparisonOperators);

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  userType: string;
}
export interface IEntity {
  id: string;
  name: string;
  slug: string;
}
export interface IUserDetails {
  id: string;
  name: string;
  phone: IPhone;
  email: string;
}

// make interface for mobile pls
export interface IPhone {
  countryPrefix: string;
  fullNumber: string;
  number: string;
}
export enum ServiceType {
  SUBSCRIPTION = 'subscription',
  ONE_TIME = 'one_time',
  SERVICE = 'service',
  PRODUCT = 'product',
}

export enum DeliveryType {
  DIGITAL = 'DIGITAL',
  PHYSICAL = 'PHYSICAL',
}
export const TAX_RATE = 5;
