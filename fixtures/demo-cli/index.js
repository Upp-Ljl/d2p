#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program.name('demo-cli').description('tiny demo for d2p smoke');
program.command('hello').action(() => console.log('hi from demo-cli'));
program.parse(process.argv);
