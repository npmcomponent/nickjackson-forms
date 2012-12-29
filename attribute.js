/**
 * Module dependencies.
 */
var Emitter = require('emitter')
  , event = require('event')
  , domify = require('domify')
  , templates = require('./template')
  , type = require('type')
  , minstache = require('minstache')
  , val = require('val');

/**
 * Expose `Attribute`.
 */

module.exports = Attribute;


/**
 * Initialize a new `Attribute` with a `name` and
 * `properties`
 *
 * @param {String} name
 * @param {Object} obj
 * @api public
 */

function Attribute(name, obj) {
  if (!name) throw Error('No name provided');
  if (!obj) throw Error('No parameters provided');

  this.name = name;

  for (var ob in obj) {
    this[ob] = obj[ob];
  }

}


/**
 * Mixin emitter.
 */

Emitter(Attribute.prototype);


/**
 * Creates elements for the particular type of fields
 *
 * @return {Attribute} self
 * @api public
 */

Attribute.prototype.render = function() {
  // check to see if repeats are enabled and then
  // run .repeats()
  if (this.repeat == "false") this.repeat = false;
  if (this.repeat) {
    this.view = this.repeats();
    return this;
  }

  // check field types and run their associated render fns.
  switch (this.type) {
    case 'Date':
    case 'Number':
    case 'String':
      // checks for specified options
      this.view = this.options
        ? this.select()
        : this.textbox();
      break;

    case 'Boolean':
      this.view = this.checkbox();
      break;

    case 'Object':
      this.view = this.object();
      break;
  }

  return this;
}


/**
 * Render `self` as a textbox and return dom
 *
 * @return {Element} dom
 * @api private
 */

Attribute.prototype.textbox = function() {
  var dom = domify(minstache(templates.textbox, this))[0]
    , textbox = dom.querySelector('input');

  this.repeatNode = textbox;
  this.el = textbox;
  return dom;
}


/**
 * Render `self` as a select box and return dom
 *
 * @return {Element} dom
 * @api private
 */

Attribute.prototype.select = function() {
  var dom = domify(minstache(templates.select, this))[0]
    , select = dom.querySelector('select');

  for (var option in this.options) {
    var view = document.createElement('option')
    view.setAttribute('value', option);
    view.innerText = this.options[option];
    select.appendChild(view);
  }

  this.repeatNode = select;
  this.el = select;
  return dom;
};


/**
 * Render `self` as a checkbox and return dom
 *
 * @return {Element} dom
 * @api private
 */

Attribute.prototype.checkbox = function() {
  var dom = domify(minstache(templates.checkbox, this))[0]
    , input = dom.querySelector('input');

  this.repeatNode = input;
  this.el = input;
  return dom;
}


/**
 * Render `self` by iterating sub-properties
 * and rendering their particular dom types
 *
 * @return {Element} dom
 * @api private
 */

Attribute.prototype.object = function() {
  var dom = domify(minstache(templates.object, this))[0]
    , nested = dom.querySelector('.nested');

  this.el = {};

  for (var property in this.properties) {
    var subParams = this.properties[property]
      , subName = this.name + '[' + property + ']'
      , subAttribute = new Attribute(subName, subParams);

    nested.appendChild(subAttribute.render().view);
    this.el[property] = subAttribute.el;
  }

  this.repeatNode = nested;
  return dom;
}


/**
 * Return new Attribute without repeat enabled
 *
 * @return {Attribute} attribute
 * @api private
 */

Attribute.prototype.repeatAttribute = function(){
  var attribute = new Attribute(this.name, this);
  delete attribute.repeat;
  return attribute.render();
}


/**
 * Enables repeating of a certain attribute
 *
 * @return {Element} attribute
 * @api private
 */

Attribute.prototype.repeats = function() {
  // set name to array
  this.name = this.name + '[]';

  // set this.el to array
  this.el = [];

  // call the attribute render function
  var attribute = this.repeatAttribute();

  // set the container to append new repeats too
  this.repeatContainer = document.createElement('div');
  this.repeatContainer.className = 'repeats';

  // parent of repeat
  var parent = attribute.repeat.parentNode;
  // remove default repeat node
  parent.removeChild(attribute.repeat);

  // if parent is a Label set to label parent
  if (parent.nodeName.toLowerCase() == 'label'){
    parent = parent.parentNode;
  }

  // append repeats to parent of label
  parent.appendChild(this.repeatContainer);

  // set repeat count
  this.repeatCount = 0;

  // set repeat max by checking repeat param
  // for Boolean or else Integer
  if (this.repeat !== true) {
    this.repeatMax = parseInt(this.repeat);
  }

  // append new node with repeat controls
  this.addRepeat();

  return attribute.view;
}


/**
 * Adds another field if multiples is enabled
 *
 * @return {Attribute} self
 * @api private
 */

Attribute.prototype.addRepeat = function(){
  var attribute = this.repeatAttribute()
    , repeat = attribute.repeat
    , controls = domify(templates.controls)[0]
    , add = controls.querySelector('.add')
    , remove = controls.querySelector('.remove');

  // only add repeat if within maximum
  if (this.repeatMax) {
    if (this.repeatCount >= this.repeatMax) return;
  }

  // adjust repeat count
  this.repeatCount++;

  // add to field
  this.el.push(attribute.el);

  // create repeat container and append
  // repeat clone and controls
  var container = document.createElement('div');
  container.className = 'repeat';
  container.appendChild(repeat);
  container.appendChild(controls);

  // append container to repeatContainer
  this.repeatContainer.appendChild(container);

  // bind click events
  event.bind(add, 'click', this.addRepeat.bind(this));
  event.bind(remove, 'click', this.removeRepeat.bind(this, container, this.repeatCount - 1));

  return this;
}


/**
 * Removes `node` if multiples is enabled
 *
 * @param {Element} node
 * @return {Attribute} self
 * @api private
 */

Attribute.prototype.removeRepeat = function(node, id){
  var parent = node.parentNode;
  parent.removeChild(node);
  this.repeatCount--;

  this.el.splice(id, 1);

  if (this.repeatCount == 0) this.addRepeat();
  return self;
}

/**
 * Gets the value of the current field
 *
 * @return {Multiple} value
 * @api private
 */

Attribute.prototype.getValue = function(){
  return getValue(this.el);
}


/**
 * functions used to itterate fields and
 * get their values.
 *
 * @api private
 */


function getValue(field) {
  if (field.nodeType) return elementValue(field);
  if (type(field) == 'object') return objectValue(field);
  if (type(field) == 'array') return arrayValue(field);
}


function elementValue(field){
  return val(field);
}


function objectValue(fields){
  var value = {};
  for (var field in fields) {
    value[field] = getValue(fields[field])
  }
  return value;
}


function arrayValue(fields){
  var value = [];
  fields.forEach(function(field){
    value.push(getValue(field))
  })
  return value;
}