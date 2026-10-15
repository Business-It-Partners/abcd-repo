// Existing window regressions need all clinic apps available in their isolated session.
export async function installDemoApps(page){
 await page.getByRole('button',{name:'App Store',exact:true}).click();const store=page.getByTestId('store-window');
 for(const name of ['Treatment Protocols','Calendar']){await store.getByRole('button',{name:`Details ${name}`,exact:true}).click();await store.getByRole('button',{name:'Get',exact:true}).click();await store.getByRole('button',{name:'Open',exact:true}).waitFor({timeout:10000});await page.waitForTimeout(2700);await store.getByRole('button',{name:'Back to apps',exact:true}).click();}
 await page.getByRole('button',{name:'Close App Store',exact:true}).click();
}
