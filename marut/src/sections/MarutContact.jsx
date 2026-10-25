import { markup } from '../marutContactMarkup';
import React from 'react';

export default function MarutContact() { return <div dangerouslySetInnerHTML={{ __html: markup }} />; }
